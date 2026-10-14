package com.camslife.healthbridge;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.view.*;
import android.widget.*;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;

public final class MainActivity extends Activity {
  private static final int PERMISSIONS = 11, FILE = 12;
  private static final String[] TYPES = {
    "STEPS", "HYDRATION", "WEIGHT", "BODY_FAT", "SLEEP", "EXERCISE"
  };
  private TextView status;
  private Button export, authorize, privacy;
  private EditText timezone;
  private Spinner range;
  private byte[] pending;
  private boolean reading = false, permissionsPending = false;

  private int dp(int value) {
    return Math.round(value * getResources().getDisplayMetrics().density);
  }

  private TextView text(String value, int size) {
    TextView t = new TextView(this);
    t.setText(value);
    t.setTextSize(size);
    t.setTextColor(Color.rgb(242, 240, 233));
    t.setFontFeatureSettings("tnum");
    t.setPadding(0, dp(6), 0, dp(6));
    return t;
  }

  private void add(LinearLayout layout, View view) {
    LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, -2);
    p.bottomMargin = dp(12);
    layout.addView(view, p);
  }

  private Button button(String label, Runnable action) {
    Button b = new Button(this);
    b.setText(label);
    b.setTextSize(16);
    b.setTextColor(Color.rgb(242, 240, 233));
    b.setAllCaps(false);
    b.setMinHeight(dp(52));
    b.setPadding(dp(16), dp(12), dp(16), dp(12));
    b.setStateListAnimator(null);
    GradientDrawable fill = new GradientDrawable();
    fill.setColor(Color.rgb(48, 66, 59));
    fill.setCornerRadius(dp(26));
    GradientDrawable mask = new GradientDrawable();
    mask.setColor(Color.WHITE);
    mask.setCornerRadius(dp(26));
    b.setBackground(new RippleDrawable(ColorStateList.valueOf(0x24ffffff), fill, mask));
    b.setOnClickListener(v -> action.run());
    return b;
  }

  public void onCreate(Bundle saved) {
    super.onCreate(saved);
    ScrollView scroll = new ScrollView(this);
    scroll.setFillViewport(true);
    scroll.setBackground(
        new GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            new int[] {Color.rgb(19, 40, 66), Color.rgb(29, 41, 55), Color.rgb(50, 37, 23)}));
    LinearLayout page = new LinearLayout(this);
    page.setOrientation(LinearLayout.VERTICAL);
    page.setPadding(dp(16), dp(24), dp(16), dp(36));
    scroll.setOnApplyWindowInsetsListener(
        (view, insets) -> {
          android.graphics.Insets safe =
              insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
          view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
          return insets;
        });
    TextView brand = text("Cam’s Life", 24);
    brand.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
    add(page, brand);
    add(page, text("Watch & Samsung Health", 23));
    add(
        page,
        text(
            "Bring your recorded readings into Cam’s Life. Your watch shares with Samsung Health,"
                + " then Health Connect on this phone.",
            17));
    LinearLayout card = new LinearLayout(this);
    card.setOrientation(LinearLayout.VERTICAL);
    card.setPadding(dp(20), dp(18), dp(20), dp(16));
    GradientDrawable bg = new GradientDrawable();
    bg.setColor(Color.argb(235, 21, 22, 26));
    bg.setCornerRadius(dp(28));
    card.setBackground(bg);
    add(card, text("1 · Link Samsung Health", 18));
    add(
        card,
        text(
            "In Samsung Health, open Settings → Health Connect. Allow sharing for the readings you"
                + " want, then sync your watch in Samsung Health.",
            16));
    add(card, text("2 · Allow read access", 18));
    add(
        card,
        text(
            "Android will show the types you can share. This companion only reads; it cannot change"
                + " your watch or Samsung Health.",
            16));
    authorize = button("Choose Health Connect access", this::permission);
    add(card, authorize);
    add(card, text("3 · Export your readings", 18));
    add(
        card,
        text(
            "Use the same timezone as your Cam’s Life profile. Missing readings stay missing. Sleep"
                + " uses recorded asleep stages; it does not turn time in bed into a sleep score.",
            16));
    add(card, text("Timezone", 15));
    timezone = new EditText(this);
    timezone.setMinHeight(dp(48));
    timezone.setSingleLine(false);
    timezone.setText("Europe/Amsterdam");
    timezone.setTextSize(16);
    timezone.setTextColor(Color.rgb(242, 240, 233));
    timezone.setInputType(
        android.text.InputType.TYPE_CLASS_TEXT
            | android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE
            | android.text.InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
    timezone.setSingleLine(false);
    add(card, timezone);
    add(card, text("Date range", 15));
    range = new Spinner(this);
    ArrayAdapter<String> choices =
        new ArrayAdapter<>(
            this,
            android.R.layout.simple_spinner_dropdown_item,
            new String[] {"Last 7 days", "Last 30 days"});
    choices.setDropDownViewResource(android.R.layout.select_dialog_singlechoice);
    range.setAdapter(choices);
    range.setMinimumHeight(dp(48));
    add(card, range);
    export = button("Export readings", this::read);
    add(card, export);
    status =
        text(
            "Choose read access, then export. Nothing has been read or saved in this session.", 16);
    status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
    add(card, status);
    add(page, card);
    add(page, text("4 · Review in Cam’s Life", 18));
    add(
        page,
        text(
            "Open Settings → Watch & Samsung Health in Cam’s Life and choose the JSON file. Review"
                + " before saving. Existing different values remain unselected, so your old records"
                + " are kept.",
            16));
    add(
        page,
        text(
            "No automatic or background sync. Food, heart readings and skeletal muscle are not"
                + " imported by this companion. You can still log them in Cam’s Life where"
                + " supported.",
            16));
    privacy =
        button(
            "Privacy & permissions", () -> startActivity(new Intent(this, PrivacyActivity.class)));
    add(page, privacy);
    scroll.addView(page);
    setContentView(scroll);
    refresh();
  }

  private void refresh() {
    int granted = 0;
    for (String type : TYPES)
      if (checkSelfPermission("android.permission.health.READ_" + type)
          == PackageManager.PERMISSION_GRANTED) granted++;
    boolean idle = !reading && pending == null && !permissionsPending;
    export.setEnabled(idle && granted > 0);
    authorize.setEnabled(idle);
    privacy.setEnabled(idle);
    for (Button b : new Button[] {export, authorize, privacy})
      b.setAlpha(b.isEnabled() ? 1f : .45f);
    timezone.setEnabled(idle);
    range.setEnabled(idle);
  }

  private void permission() {
    List<String> missing = new ArrayList<>();
    for (String type : TYPES)
      if (checkSelfPermission("android.permission.health.READ_" + type)
          != PackageManager.PERMISSION_GRANTED)
        missing.add("android.permission.health.READ_" + type);
    if (missing.isEmpty()) {
      status.setText(
          "Read access is allowed for all six types. Export only reads data available in Health"
              + " Connect.");
      refresh();
      return;
    }
    permissionsPending = true;
    refresh();
    requestPermissions(missing.toArray(new String[0]), PERMISSIONS);
  }

  public void onRequestPermissionsResult(int code, String[] names, int[] results) {
    super.onRequestPermissionsResult(code, names, results);
    if (code == PERMISSIONS) {
      permissionsPending = false;
      int n = 0;
      for (String type : TYPES)
        if (checkSelfPermission("android.permission.health.READ_" + type)
            == PackageManager.PERMISSION_GRANTED) n++;
      status.setText(
          n == 0
              ? "No types allowed. Nothing was read."
              : "Read access allowed for " + n + " of 6 types. Other readings stay missing.");
      refresh();
    }
  }

  private void read() {
    if (reading || pending != null) return;
    final ZoneId zone;
    try {
      zone = ZoneId.of(timezone.getText().toString().trim());
    } catch (Exception e) {
      status.setText("Enter a valid timezone, such as Europe/Amsterdam.");
      return;
    }
    reading = true;
    status.setText("Reading allowed types from Health Connect… Keep this app open.");
    refresh();
    int count = range.getSelectedItemPosition() == 0 ? 7 : 30;
    ExecutorService task = Executors.newSingleThreadExecutor();
    task.execute(
        () -> {
          try {
            org.json.JSONObject data = new HealthReader(this).export(count, zone);
            byte[] bytes = data.toString(2).getBytes(StandardCharsets.UTF_8);
            runOnUiThread(
                () -> {
                  if (isFinishing() || isDestroyed()) return;
                  reading = false;
                  if (data.optJSONArray("days").length() == 0) {
                    status.setText(
                        "No supported readings were found. Check Samsung Health → Settings → Health"
                            + " Connect and sync your watch.");
                    refresh();
                    return;
                  }
                  pending = bytes;
                  status.setText(
                      "Readings are ready in memory. Choose a file location; nothing has been sent"
                          + " to Cam’s Life.");
                  refresh();
                  Intent save =
                      new Intent(Intent.ACTION_CREATE_DOCUMENT)
                          .addCategory(Intent.CATEGORY_OPENABLE)
                          .setType("application/json")
                          .putExtra(
                              Intent.EXTRA_TITLE,
                              "cams-life-health-connect-" + LocalDate.now(zone) + ".json");
                  try {
                    startActivityForResult(save, FILE);
                  } catch (Exception unavailable) {
                    pending = null;
                    status.setText("Android’s file picker is unavailable. No export was saved.");
                    refresh();
                  }
                });
          } catch (Exception error) {
            runOnUiThread(
                () -> {
                  if (isFinishing() || isDestroyed()) return;
                  reading = false;
                  pending = null;
                  status.setText(
                      "Health Connect could not be read. Check allowed types and Samsung Health"
                          + " sharing, then retry. No export was saved.");
                  refresh();
                });
          } finally {
            task.shutdown();
          }
        });
  }

  protected void onActivityResult(int code, int result, Intent data) {
    super.onActivityResult(code, result, data);
    if (code != FILE) return;
    byte[] bytes = pending;
    pending = null;
    if (result != RESULT_OK || data == null || data.getData() == null || bytes == null) {
      status.setText("Export canceled. No file was saved by this companion.");
      refresh();
      return;
    }
    Uri uri = data.getData();
    try (OutputStream out = getContentResolver().openOutputStream(uri, "wt")) {
      if (out == null) throw new IllegalStateException();
      out.write(bytes);
      status.setText(
          "Export saved to your chosen file. In Cam’s Life, open Settings → Watch & Samsung Health"
              + " to review it.");
    } catch (Exception e) {
      status.setText("The export could not be confirmed. Check the selected file before retrying.");
    }
    refresh();
  }
}
