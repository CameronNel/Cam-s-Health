package com.camslife.healthbridge;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.view.WindowInsets;
import android.widget.*;

public final class PrivacyActivity extends Activity {
  public void onCreate(Bundle state) {
    super.onCreate(state);
    ScrollView scroll = new ScrollView(this);
    scroll.setBackground(
        new GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            new int[] {Color.rgb(19, 40, 66), Color.rgb(29, 41, 55), Color.rgb(50, 37, 23)}));
    scroll.setOnApplyWindowInsetsListener(
        (view, insets) -> {
          android.graphics.Insets safe =
              insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
          view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
          return insets;
        });
    float density = getResources().getDisplayMetrics().density;
    LinearLayout page = new LinearLayout(this);
    page.setOrientation(LinearLayout.VERTICAL);
    page.setPadding(
        Math.round(16 * density),
        Math.round(24 * density),
        Math.round(16 * density),
        Math.round(36 * density));
    TextView title = new TextView(this);
    title.setText("Privacy & permissions");
    title.setTextColor(Color.rgb(242, 240, 233));
    title.setTextSize(24);
    title.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
    LinearLayout.LayoutParams header = new LinearLayout.LayoutParams(-1, -2);
    header.bottomMargin = Math.round(24 * density);
    page.addView(title, header);
    TextView text = new TextView(this);
    text.setTextColor(Color.rgb(242, 240, 233));
    text.setTextSize(17);
    text.setPadding(
        Math.round(20 * density),
        Math.round(24 * density),
        Math.round(20 * density),
        Math.round(28 * density));
    GradientDrawable card = new GradientDrawable();
    card.setColor(Color.argb(235, 21, 22, 26));
    card.setCornerRadius(Math.round(28 * density));
    text.setBackground(card);
    text.setText(
        "Cam’s Life · Watch\n\n"
            + "This companion only reads the Health Connect data types you allow: steps, water,"
            + " weight, body fat, sleep and recorded exercise.\n\n"
            + "It has no internet permission, no account, no analytics, no background service and"
            + " no access to GitHub or Gmail. It does not write to Health Connect or your"
            + " watch.\n\n"
            + "An export stays in memory until you choose a file location. Android controls that"
            + " file location. The export may contain health history, source app identifiers and"
            + " record timestamps. Choose local phone storage. A cloud-backed destination may sync"
            + " your exported health file.\n\n"
            + "Importing into Cam’s Life is a separate action. The app shows a review first;"
            + " differing existing values are not selected automatically. Saving requires your"
            + " existing GitHub authorization. The Cam-s-Health health repository is public, so"
            + " accepted readings become public when saved.\n\n"
            + "You can revoke access in Android Settings → Health Connect → App permissions at any"
            + " time. Uninstalling this companion does not delete Health Connect or Samsung Health"
            + " records. It also does not delete an export you saved separately.");
    page.addView(text);
    scroll.addView(page);
    setContentView(scroll);
  }
}
