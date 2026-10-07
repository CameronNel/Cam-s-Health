package com.camslife.healthbridge;

import android.content.Context;
import android.content.pm.PackageManager;
import android.health.connect.*;
import android.health.connect.datatypes.*;
import android.health.connect.datatypes.Record;
import android.health.connect.datatypes.units.Volume;
import android.os.OutcomeReceiver;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.json.*;

/** Read-only Android 14+ bridge. No network, credentials or on-device database. */
final class HealthReader {
  private final Context context;
  private final HealthConnectManager manager;
  private final ExecutorService callbacks = Executors.newCachedThreadPool();
  private static final String SAMSUNG = "com.sec.android.app.shealth";

  HealthReader(Context context) {
    this.context = context;
    manager = context.getSystemService(HealthConnectManager.class);
  }

  boolean allowed(String name) {
    return context.checkSelfPermission("android.permission.health.READ_" + name)
        == PackageManager.PERMISSION_GRANTED;
  }

  private TimeInstantRangeFilter range(Instant start, Instant end) {
    return new TimeInstantRangeFilter.Builder().setStartTime(start).setEndTime(end).build();
  }

  private <T extends Record> List<T> read(Class<T> type, Instant start, Instant end)
      throws Exception {
    List<T> all = new ArrayList<>();
    long token = -1;
    do {
      CompletableFuture<ReadRecordsResponse<T>> result = new CompletableFuture<>();
      ReadRecordsRequestUsingFilters.Builder<T> builder =
          new ReadRecordsRequestUsingFilters.Builder<>(type)
              .setTimeRangeFilter(range(start, end))
              .setPageSize(1000);
      if (token != -1) builder.setPageToken(token);
      manager.readRecords(
          builder.build(),
          callbacks,
          new OutcomeReceiver<ReadRecordsResponse<T>, HealthConnectException>() {
            public void onResult(ReadRecordsResponse<T> value) {
              result.complete(value);
            }

            public void onError(HealthConnectException error) {
              result.completeExceptionally(error);
            }
          });
      ReadRecordsResponse<T> response = result.get(25, TimeUnit.SECONDS);
      all.addAll(response.getRecords());
      token = response.getNextPageToken();
      if (all.size() > 50000)
        throw new IllegalStateException("Too many records. Export a shorter range.");
    } while (token != -1);
    return all;
  }

  private <T> AggregateRecordsResponse<T> aggregate(
      AggregationType<T> metric, Instant start, Instant end) throws Exception {
    CompletableFuture<AggregateRecordsResponse<T>> result = new CompletableFuture<>();
    manager.aggregate(
        new AggregateRecordsRequest.Builder<T>(range(start, end))
            .addAggregationType(metric)
            .build(),
        callbacks,
        new OutcomeReceiver<AggregateRecordsResponse<T>, HealthConnectException>() {
          public void onResult(AggregateRecordsResponse<T> value) {
            result.complete(value);
          }

          public void onError(HealthConnectException error) {
            result.completeExceptionally(error);
          }
        });
    return result.get(25, TimeUnit.SECONDS);
  }

  private JSONObject source(Collection<String> ids, Collection<String> packages, Instant recordedAt)
      throws JSONException {
    return new JSONObject()
        .put("recordIds", new JSONArray(new TreeSet<>(ids)))
        .put("appPackages", new JSONArray(new TreeSet<>(packages)))
        .put("recordedAt", recordedAt.toString());
  }

  private JSONObject source(Record record, Instant time) throws JSONException {
    return source(
        Collections.singleton(record.getMetadata().getId()),
        Collections.singleton(record.getMetadata().getDataOrigin().getPackageName()),
        time);
  }

  private Set<String> packages(Set<DataOrigin> origins) {
    Set<String> names = new TreeSet<>();
    for (DataOrigin origin : origins) names.add(origin.getPackageName());
    return names;
  }

  private JSONObject day(Map<String, JSONObject> days, String date) throws JSONException {
    if (!days.containsKey(date))
      days.put(date, new JSONObject().put("date", date).put("sources", new JSONObject()));
    return days.get(date);
  }

  private void metric(
      Map<String, JSONObject> days, String date, String key, double value, JSONObject source)
      throws JSONException {
    JSONObject d = day(days, date);
    d.put(key, value);
    d.getJSONObject("sources").put(key, source);
  }

  private double precise(double v) {
    return Math.round(v * 1000.0) / 1000.0;
  }

  private <T extends InstantRecord> Map<String, T> latest(List<T> records, ZoneId zone) {
    Map<String, T> result = new TreeMap<>();
    for (T r : records) {
      String date = r.getTime().atZone(zone).toLocalDate().toString();
      T old = result.get(date);
      if (old == null
          || r.getTime().isAfter(old.getTime())
          || (r.getTime().equals(old.getTime())
              && r.getMetadata()
                  .getLastModifiedTime()
                  .isAfter(old.getMetadata().getLastModifiedTime()))) result.put(date, r);
    }
    return result;
  }

  JSONObject export(int count, ZoneId zone) throws Exception {
    try {
      if (manager == null)
        throw new IllegalStateException("Health Connect is unavailable on this phone.");
      Instant exportedAt = Instant.now();
      LocalDate today = exportedAt.atZone(zone).toLocalDate(), first = today.minusDays(count - 1);
      Instant start = first.atStartOfDay(zone).toInstant(), end = exportedAt;
      Map<String, JSONObject> days = new TreeMap<>();
      for (LocalDate date = first; !date.isAfter(today); date = date.plusDays(1)) {
        Instant ds = date.atStartOfDay(zone).toInstant(),
            de = date.plusDays(1).atStartOfDay(zone).toInstant();
        if (de.isAfter(end)) de = end;
        if (allowed("STEPS")) {
          AggregateRecordsResponse<Long> totals = aggregate(StepsRecord.STEPS_COUNT_TOTAL, ds, de);
          Long value = totals.get(StepsRecord.STEPS_COUNT_TOTAL);
          Set<String> origins = packages(totals.getDataOrigins(StepsRecord.STEPS_COUNT_TOTAL));
          if (value != null && !origins.isEmpty())
            metric(
                days,
                date.toString(),
                "steps",
                value,
                source(Collections.singleton("steps-aggregate-" + date), origins, exportedAt));
        }
        if (allowed("HYDRATION")) {
          AggregateRecordsResponse<Volume> totals = aggregate(HydrationRecord.VOLUME_TOTAL, ds, de);
          Volume value = totals.get(HydrationRecord.VOLUME_TOTAL);
          Set<String> origins = packages(totals.getDataOrigins(HydrationRecord.VOLUME_TOTAL));
          if (value != null && !origins.isEmpty())
            metric(
                days,
                date.toString(),
                "waterMl",
                precise(value.getInLiters() * 1000),
                source(Collections.singleton("hydration-aggregate-" + date), origins, exportedAt));
        }
      }
      if (allowed("WEIGHT"))
        for (Map.Entry<String, WeightRecord> e :
            latest(read(WeightRecord.class, start, end), zone).entrySet())
          metric(
              days,
              e.getKey(),
              "weightKg",
              precise(e.getValue().getWeight().getInGrams() / 1000),
              source(e.getValue(), e.getValue().getTime()));
      if (allowed("BODY_FAT"))
        for (Map.Entry<String, BodyFatRecord> e :
            latest(read(BodyFatRecord.class, start, end), zone).entrySet())
          metric(
              days,
              e.getKey(),
              "bodyFatPct",
              precise(e.getValue().getPercentage().getValue()),
              source(e.getValue(), e.getValue().getTime()));
      if (allowed("EXERCISE")) {
        List<ExerciseSessionRecord> sessions = read(ExerciseSessionRecord.class, start, end);
        for (ExerciseSessionRecord r : sessions) {
          String date = r.getStartTime().atZone(zone).toLocalDate().toString();
          if (date.compareTo(first.toString()) < 0 || date.compareTo(today.toString()) > 0)
            continue;
          if (r.getEndTime().isAfter(end) || !r.getEndTime().isAfter(r.getStartTime())) continue;
          // Session IDs remain stable; no prescribed session, sets or load are guessed.
          String title = r.getTitle() == null ? "Recorded workout" : r.getTitle().toString().trim();
          if (title.isEmpty()) title = "Recorded workout";
          JSONObject w =
              new JSONObject()
                  .put("id", r.getMetadata().getId())
                  .put("name", title)
                  .put(
                      "durationMin",
                      precise(
                          Duration.between(r.getStartTime(), r.getEndTime()).toMillis() / 60000.0))
                  .put("startTime", r.getStartTime().toString())
                  .put("endTime", r.getEndTime().toString())
                  .put("appPackage", r.getMetadata().getDataOrigin().getPackageName());
          JSONObject d = day(days, date);
          if (!d.has("workouts")) d.put("workouts", new JSONArray());
          d.getJSONArray("workouts").put(w);
        }
      }
      if (allowed("SLEEP")) readSleep(days, start, end, first, today, zone);
      JSONArray entries = new JSONArray();
      for (JSONObject d : days.values()) entries.put(d);
      return new JSONObject()
          .put("format", "cams-life-health-connect")
          .put("version", 1)
          .put("exportedAt", exportedAt.toString())
          .put("timezone", zone.getId())
          .put("days", entries);
    } finally {
      callbacks.shutdownNow();
    }
  }

  private void readSleep(
      Map<String, JSONObject> days,
      Instant start,
      Instant end,
      LocalDate first,
      LocalDate today,
      ZoneId zone)
      throws Exception {
    // Group by wake date, including the previous evening. Do not call time in bed sleep.
    List<SleepSessionRecord> records =
        read(SleepSessionRecord.class, start.minus(Duration.ofDays(1)), end);
    Map<String, List<SleepSessionRecord>> byDate = new TreeMap<>();
    for (SleepSessionRecord r : records) {
      String date = r.getEndTime().atZone(zone).toLocalDate().toString();
      if (date.compareTo(first.toString()) >= 0
          && date.compareTo(today.toString()) <= 0
          && !r.getEndTime().isAfter(end))
        byDate.computeIfAbsent(date, k -> new ArrayList<>()).add(r);
    }
    for (Map.Entry<String, List<SleepSessionRecord>> e : byDate.entrySet()) {
      List<SleepSessionRecord> selected = e.getValue();
      boolean samsung =
          selected.stream()
              .anyMatch(r -> r.getMetadata().getDataOrigin().getPackageName().equals(SAMSUNG));
      List<long[]> intervals = new ArrayList<>();
      Set<String> ids = new TreeSet<>(), apps = new TreeSet<>();
      Instant recordedAt = Instant.EPOCH;
      boolean incomplete = false;
      for (SleepSessionRecord r : selected) {
        if (samsung && !r.getMetadata().getDataOrigin().getPackageName().equals(SAMSUNG)) continue;
        if (r.getStages().isEmpty()) {
          incomplete = true;
          continue;
        }
        List<long[]> coverage = new ArrayList<>();
        boolean included = false;
        for (SleepSessionRecord.Stage stage : r.getStages()) {
          int t = stage.getType();
          if (t == SleepSessionRecord.StageType.STAGE_TYPE_UNKNOWN) {
            incomplete = true;
            continue;
          }
          long ca = Math.max(stage.getStartTime().toEpochMilli(), r.getStartTime().toEpochMilli()),
              cb = Math.min(stage.getEndTime().toEpochMilli(), r.getEndTime().toEpochMilli());
          if (cb > ca) coverage.add(new long[] {ca, cb});
          if (t != SleepSessionRecord.StageType.STAGE_TYPE_SLEEPING
              && t != SleepSessionRecord.StageType.STAGE_TYPE_SLEEPING_LIGHT
              && t != SleepSessionRecord.StageType.STAGE_TYPE_SLEEPING_DEEP
              && t != SleepSessionRecord.StageType.STAGE_TYPE_SLEEPING_REM) continue;
          long a = Math.max(stage.getStartTime().toEpochMilli(), r.getStartTime().toEpochMilli()),
              b = Math.min(stage.getEndTime().toEpochMilli(), r.getEndTime().toEpochMilli());
          if (b > a) {
            intervals.add(new long[] {a, b});
            included = true;
          }
        }
        coverage.sort(Comparator.comparingLong(a -> a[0]));
        long covered = 0, coverStart = -1, coverEnd = -1;
        for (long[] c : coverage) {
          if (coverStart < 0) {
            coverStart = c[0];
            coverEnd = c[1];
          } else if (c[0] <= coverEnd) coverEnd = Math.max(coverEnd, c[1]);
          else {
            covered += coverEnd - coverStart;
            coverStart = c[0];
            coverEnd = c[1];
          }
        }
        if (coverStart >= 0) covered += coverEnd - coverStart;
        if (Duration.between(r.getStartTime(), r.getEndTime()).toMillis() - covered > 60000)
          incomplete = true;
        if (included) {
          ids.add(r.getMetadata().getId());
          apps.add(r.getMetadata().getDataOrigin().getPackageName());
          if (r.getEndTime().isAfter(recordedAt)) recordedAt = r.getEndTime();
        }
      }
      if (incomplete || intervals.isEmpty()) continue;
      intervals.sort(Comparator.comparingLong(a -> a[0]));
      long total = 0, a = intervals.get(0)[0], b = intervals.get(0)[1];
      for (int i = 1; i < intervals.size(); i++) {
        long[] v = intervals.get(i);
        if (v[0] <= b) b = Math.max(b, v[1]);
        else {
          total += b - a;
          a = v[0];
          b = v[1];
        }
      }
      total += b - a;
      double hours = precise(total / 3600000.0);
      if (hours <= 24) metric(days, e.getKey(), "sleepHours", hours, source(ids, apps, recordedAt));
    }
  }
}
