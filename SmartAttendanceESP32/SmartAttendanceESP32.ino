#include <time.h>
#include <sys/time.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include "secrets.h"
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <WebServer.h>
#include "config.h"

int sessionCount = 0;
int todayCount = 0;
int previousSessionCount = 0;

bool sessionActive = false;
String activeSessionId = "";

unsigned long lastPoll = 0;
const unsigned long pollInterval = 1000;

unsigned long lastReconnectAttempt = 0;
const unsigned long reconnectInterval = 5000;

// Connection status flags — drive the persistent LED state
bool backendConnected = false;
bool hasEverConnected  = false;

unsigned long buttonPressedAt = 0;
bool longPressHandled = false;
const unsigned long longPressDuration = 2000;
const unsigned long configPressDuration = 8000;
const unsigned long wifiConnectTimeout = 15000;

// Software debounce — prevents GPIO noise from faking button events
bool rawButtonPrev = HIGH;           // last raw reading (for edge detection)
unsigned long lastDebounceTime = 0;  // when the raw reading last changed
const unsigned long DEBOUNCE_DELAY = 50; // ms the signal must be stable

struct RuntimeConfig {
  String ssid;
  String password;
  String deviceId;
  String baseUrl;
  String apiKey;
};

RuntimeConfig runtimeConfig;
Preferences preferences;
WebServer configServer(80);
bool configPortalActive = false;
bool configRoutesRegistered = false;
bool preferencesReady = false;
bool pendingPortalShutdown = false;
unsigned long portalShutdownAt = 0;

String getDefaultSsid() {
  return String(DEFAULT_WIFI_SSID);
}

String getDefaultPassword() {
  return String(DEFAULT_WIFI_PASSWORD);
}

String getDefaultDeviceId() {
  return String(DEFAULT_DEVICE_ID);
}

String getDefaultBaseUrl() {
  return String(DEFAULT_BASE_URL);
}

String getDefaultApiKey() {
  return String(DEFAULT_API_KEY);
}

String portalSsid() {
  return String(CONFIG_AP_NAME) + "-" + String((uint32_t)ESP.getEfuseMac(), HEX);
}

bool hasRuntimeConfig() {
  return runtimeConfig.ssid.length() > 0
    && runtimeConfig.baseUrl.length() > 0
    && runtimeConfig.apiKey.length() > 0;
}

void ensurePreferencesReady() {
  if (preferencesReady) {
    return;
  }

  preferences.begin("attendance", false);
  preferencesReady = true;
}

void loadRuntimeConfig() {
  ensurePreferencesReady();
  runtimeConfig.ssid = preferences.getString("ssid", getDefaultSsid());
  runtimeConfig.password = preferences.getString("password", getDefaultPassword());
  runtimeConfig.deviceId = preferences.getString("deviceId", getDefaultDeviceId());
  runtimeConfig.baseUrl = preferences.getString("baseUrl", getDefaultBaseUrl());
  runtimeConfig.apiKey = preferences.getString("apiKey", getDefaultApiKey());
}

void saveRuntimeConfig(
  const String& nextSsid,
  const String& nextPassword,
  const String& nextDeviceId,
  const String& nextBaseUrl,
  const String& nextApiKey
) {
  ensurePreferencesReady();
  preferences.putString("ssid", nextSsid);
  preferences.putString("password", nextPassword);
  preferences.putString("deviceId", nextDeviceId);
  preferences.putString("baseUrl", nextBaseUrl);
  preferences.putString("apiKey", nextApiKey);
  loadRuntimeConfig();
}

void clearRuntimeConfig() {
  ensurePreferencesReady();
  preferences.clear();
  loadRuntimeConfig();
}

String htmlEscape(const String& value) {
  String output = value;
  output.replace("&", "&amp;");
  output.replace("\"", "&quot;");
  output.replace("<", "&lt;");
  output.replace(">", "&gt;");
  return output;
}

String buildPortalPage(const String& message = "") {
  String page = "<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width, initial-scale=1'>";
  page += "<title>Attendance Terminal Setup</title>";
  page += "<style>body{font-family:Arial,sans-serif;background:#f8fafc;color:#0f172a;padding:24px;}";
  page += ".card{max-width:640px;margin:0 auto;background:#fff;border:1px solid #cbd5e1;border-radius:18px;padding:24px;box-shadow:0 12px 28px rgba(15,23,42,.08);}";
  page += "h1{margin-top:0;}label{display:block;margin:14px 0 6px;font-weight:700;}input{width:100%;padding:12px;border-radius:12px;border:1px solid #94a3b8;box-sizing:border-box;}";
  page += "button{margin-top:18px;padding:12px 18px;border:none;border-radius:999px;background:#2563eb;color:#fff;font-weight:700;cursor:pointer;}";
  page += ".secondary{background:#e2e8f0;color:#0f172a;} .note{margin-top:12px;color:#475569;} .message{padding:12px 14px;border-radius:12px;background:#dbeafe;color:#1d4ed8;margin-bottom:16px;}</style></head><body>";
  page += "<div class='card'><h1>Attendance Terminal Setup</h1>";
  page += "<p class='note'>Connect this terminal to a new Wi-Fi network or change backend settings without reflashing.</p>";
  if (message.length() > 0) {
    page += "<div class='message'>" + htmlEscape(message) + "</div>";
  }
  page += "<form method='POST' action='/save'>";
  page += "<label>Wi-Fi SSID</label><input name='ssid' value='" + htmlEscape(runtimeConfig.ssid) + "' required>";
  page += "<label>Wi-Fi Password</label><input name='password' type='password' value='" + htmlEscape(runtimeConfig.password) + "'>";
  page += "<label>Device ID</label><input name='deviceId' value='" + htmlEscape(runtimeConfig.deviceId) + "' required>";
  page += "<label>Backend Base URL</label><input name='baseUrl' value='" + htmlEscape(runtimeConfig.baseUrl) + "' placeholder='http://192.168.1.214:3000' required>";
  page += "<label>Device API Key</label><input name='apiKey' value='" + htmlEscape(runtimeConfig.apiKey) + "' required>";
  page += "<button type='submit'>Save and Connect</button></form>";
  page += "<form method='POST' action='/clear'><button class='secondary' type='submit'>Clear Saved Config</button></form>";
  page += "<p class='note'>Portal address: http://" + WiFi.softAPIP().toString() + "</p></div></body></html>";
  return page;
}

bool connectWiFi();
void startConfigPortal(const String& reason);
void stopConfigPortal();
void allOutputsOff();
void applyStatusLeds();

void ensureConfigRoutes() {
  if (configRoutesRegistered) {
    return;
  }

  configServer.on("/", HTTP_GET, []() {
    configServer.send(200, "text/html", buildPortalPage());
  });

  configServer.on("/save", HTTP_POST, []() {
    const String nextSsid = configServer.arg("ssid");
    const String nextPassword = configServer.arg("password");
    const String nextDeviceId = configServer.arg("deviceId");
    const String nextBaseUrl = configServer.arg("baseUrl");
    const String nextApiKey = configServer.arg("apiKey");

    if (nextSsid.length() == 0 || nextDeviceId.length() == 0 || nextBaseUrl.length() == 0 || nextApiKey.length() == 0) {
      configServer.send(400, "text/html", buildPortalPage("SSID, device ID, backend URL, and API key are required."));
      return;
    }

    saveRuntimeConfig(nextSsid, nextPassword, nextDeviceId, nextBaseUrl, nextApiKey);
    configServer.send(200, "text/html", "<html><body style='font-family:Arial;padding:24px;'><h2>Saved</h2><p>The terminal will now connect using the new settings.</p></body></html>");
    pendingPortalShutdown = true;
    portalShutdownAt = millis() + 1200;
  });

  configServer.on("/clear", HTTP_POST, []() {
    clearRuntimeConfig();
    configServer.send(200, "text/html", "<html><body style='font-family:Arial;padding:24px;'><h2>Config Cleared</h2><p>The terminal will stay in setup mode.</p></body></html>");
  });

  configServer.onNotFound([]() {
    configServer.sendHeader("Location", "/", true);
    configServer.send(302, "text/plain", "");
  });

  configRoutesRegistered = true;
}

String buildApiUrl(const char* path) {
  return runtimeConfig.baseUrl + path;
}

// Helper to initialize HTTPClient with HTTPS/SSL support and explicit timeout
bool beginHttp(HTTPClient& http, WiFiClientSecure& client, const String& url) {
  http.setTimeout(5000);
  if (url.startsWith("https://")) {
    client.setInsecure();
    return http.begin(client, url);
  }
  return http.begin(url);
}

void allOutputsOff() {
  digitalWrite(GREEN_LED, LOW);
  digitalWrite(RED_LED, LOW);
  digitalWrite(BUZZER, LOW);
}

// Reflects the current connection state on the status LEDs (persistent indicator):
//   RED only  — system on, never connected to backend yet
//   GREEN only — connected to backend
//   BOTH on    — was connected, now disconnected
void applyStatusLeds() {
  if (backendConnected) {
    digitalWrite(GREEN_LED, HIGH);
    digitalWrite(RED_LED, LOW);
  } else if (hasEverConnected) {
    // Lost connection after being online — both LEDs on
    digitalWrite(GREEN_LED, HIGH);
    digitalWrite(RED_LED, HIGH);
  } else {
    // Startup / never connected — RED only
    digitalWrite(GREEN_LED, LOW);
    digitalWrite(RED_LED, HIGH);
  }
}

void startConfigPortal(const String& reason) {
  if (configPortalActive) {
    return;
  }

  WiFi.disconnect(true, true);
  WiFi.mode(WIFI_AP);
  WiFi.softAP(portalSsid().c_str(), CONFIG_AP_PASSWORD);
  ensureConfigRoutes();
  configServer.begin();
  configPortalActive = true;
  pendingPortalShutdown = false;

  Serial.println();
  Serial.println("==========");
  Serial.println("Configuration portal started.");
  Serial.print("Reason: ");
  Serial.println(reason);
  Serial.print("Connect to SSID: ");
  Serial.println(portalSsid());
  Serial.print("Open: http://");
  Serial.println(WiFi.softAPIP());
}

void stopConfigPortal() {
  if (!configPortalActive) {
    return;
  }

  configServer.stop();
  WiFi.softAPdisconnect(true);
  configPortalActive = false;
  pendingPortalShutdown = false;
}

void handleConfigPortal() {
  if (!configPortalActive) {
    return;
  }

  configServer.handleClient();

  if (pendingPortalShutdown && millis() >= portalShutdownAt) {
    pendingPortalShutdown = false;
    stopConfigPortal();
    if (!connectWiFi()) {
      startConfigPortal("Saved settings could not connect. Review the network or backend values.");
    } else {
      lastPoll = 0;
    }
  }
}

bool connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

  if (!hasRuntimeConfig()) {
    return false;
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(runtimeConfig.ssid.c_str(), runtimeConfig.password.c_str());
  Serial.print("Connecting to WiFi: ");
  Serial.println(runtimeConfig.ssid);

  const unsigned long startedAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < wifiConnectTimeout) {
    delay(100);
    handleButton();
    if (WiFi.status() == WL_CONNECTED) {
      break;
    }
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println();
    Serial.println("WiFi connection timed out.");
    return false;
  }

  Serial.println();
  Serial.println("Connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
  return true;
}

void maintainWiFi() {
  if (configPortalActive) {
    return;
  }

  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  const unsigned long now = millis();
  if (now - lastReconnectAttempt < reconnectInterval) {
    return;
  }

  lastReconnectAttempt = now;
  Serial.println("WiFi disconnected. Reconnecting...");
  WiFi.disconnect();
  if (hasRuntimeConfig()) {
    WiFi.begin(runtimeConfig.ssid.c_str(), runtimeConfig.password.c_str());
  }
}

void setup() {
  Serial.begin(115200);

  pinMode(GREEN_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);
  pinMode(BUTTON, INPUT_PULLUP);
  pinMode(BUZZER, OUTPUT);

  allOutputsOff();
  digitalWrite(RED_LED, HIGH); // System on — waiting to connect to backend

  // Brief stabilisation pause — lets the power rail settle after boot
  // before driving the buzzer, which avoids a silent or clipped beep.
  delay(200);

  // Two startup beeps — "ready" pattern, works on both active and passive buzzers
  for (int i = 0; i < 2; i++) {
    digitalWrite(BUZZER, HIGH);
    delay(250);
    digitalWrite(BUZZER, LOW);
    if (i < 1) delay(150); // gap between the two beeps
  }

  loadRuntimeConfig();
  if (hasRuntimeConfig()) {
    Serial.println("Saved Wi-Fi credentials found. Connecting directly...");
    connectWiFi();
  } else {
    startConfigPortal("No saved Wi-Fi settings found.");
  }
}

void handleButton() {
  const bool rawReading = (bool)digitalRead(BUTTON);
  const unsigned long now = millis();

  // --- Software debounce -------------------------------------------
  // Every time the raw reading changes, restart the stability timer.
  if (rawReading != rawButtonPrev) {
    lastDebounceTime = now;
    rawButtonPrev = rawReading;
  }
  // Only accept the reading as stable once it has held for DEBOUNCE_DELAY.
  // Until then, keep the last known stable state (lastButton).
  const bool currentButton = ((now - lastDebounceTime) >= DEBOUNCE_DELAY)
                               ? rawReading
                               : lastButton;
  // -----------------------------------------------------------------

  if (lastButton == HIGH && currentButton == LOW) {
    buttonPressedAt = now;
    longPressHandled = false;
  }

  if (currentButton == LOW
      && sessionActive
      && activeSessionId.length() > 0
      && !longPressHandled
      && now - buttonPressedAt >= longPressDuration) {
    longPressHandled = true;
    Serial.println("Long press detected. Ending active session...");
    endActiveSession();
  }

  if (currentButton == LOW
      && !sessionActive
      && !configPortalActive
      && !longPressHandled
      && now - buttonPressedAt >= configPressDuration) {
    longPressHandled = true;
    Serial.println("Long press detected. Opening setup portal...");
    startConfigPortal("Manual setup requested from the hardware button.");
  }

  if (lastButton == LOW && currentButton == HIGH) {
    if (!longPressHandled) {
      Serial.println("Short press detected. Refreshing device status...");
      checkAttendanceUpdates();
    }
    buttonPressedAt = 0;
  }

  lastButton = currentButton;
}

void loop() {
  handleConfigPortal();
  maintainWiFi();
  handleButton();

  if (configPortalActive) {
    delay(10);
    return;
  }

  if (millis() - lastPoll > pollInterval) {
    lastPoll = millis();
    checkAttendanceUpdates();
  }
}

void sessionStartedFeedback() {
  allOutputsOff();
  digitalWrite(GREEN_LED, HIGH);

  digitalWrite(BUZZER, HIGH);
  delay(180);
  digitalWrite(BUZZER, LOW);
  delay(120);

  digitalWrite(GREEN_LED, LOW);
  applyStatusLeds();

  Serial.println("Attendance session is active.");
  Serial.print("Session ID: ");
  Serial.println(activeSessionId);
}

void sessionEndedFeedback() {
  allOutputsOff();

  for (int i = 0; i < 3; i++) {
    digitalWrite(RED_LED, HIGH);
    digitalWrite(BUZZER, HIGH);
    delay(90);
    digitalWrite(BUZZER, LOW);
    delay(90);
    digitalWrite(RED_LED, LOW);
    if (i < 2) delay(60);
  }

  applyStatusLeds();

  Serial.println("Attendance session ended.");
  Serial.print("Today's Total: ");
  Serial.println(todayCount);
}

void errorFeedback() {
  allOutputsOff();

  for (int i = 0; i < 2; i++) {
    digitalWrite(RED_LED, HIGH);
    digitalWrite(BUZZER, HIGH);
    delay(100);
    digitalWrite(BUZZER, LOW);
    delay(100);
    digitalWrite(RED_LED, LOW);
    if (i < 1) delay(80);
  }

  applyStatusLeds();
  Serial.println("Request failed.");
}

void studentCheckedIn() {
  Serial.println("New verified attendance.");

  // Blink green twice — one buzzer beep per blink
  for (int i = 0; i < 2; i++) {
    digitalWrite(GREEN_LED, HIGH);
    digitalWrite(BUZZER, HIGH);
    delay(150);
    digitalWrite(BUZZER, LOW);
    delay(100);
    digitalWrite(GREEN_LED, LOW);
    if (i < 1) delay(150); // gap between the two blinks
  }

  applyStatusLeds(); // restore persistent connection LED state

  Serial.print("Current Session: ");
  Serial.println(sessionCount);

  Serial.print("Today's Total: ");
  Serial.println(todayCount);
}

void endActiveSession() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi unavailable.");
    errorFeedback();
    return;
  }

  if (!sessionActive || activeSessionId.length() == 0) {
    Serial.println("No active session to end.");
    return;
  }

  HTTPClient http;
  WiFiClientSecure client;
  beginHttp(http, client, buildApiUrl("/api/session/end"));

  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", runtimeConfig.apiKey);
  http.addHeader("X-Device-Id", runtimeConfig.deviceId);

  DynamicJsonDocument requestDoc(256);
  requestDoc["sessionId"] = activeSessionId;

  String requestBody;
  serializeJson(requestDoc, requestBody);

  Serial.println("==========");
  Serial.println("Ending current session...");
  Serial.println(requestBody);

  const int responseCode = http.POST(requestBody);
  const String response = http.getString();

  Serial.print("HTTP Code: ");
  Serial.println(responseCode);
  Serial.println("Server Response:");
  Serial.println(response);

  if (responseCode != 200) {
    errorFeedback();
  }

  http.end();
  lastPoll = 0;
}

void checkAttendanceUpdates() {
  if (WiFi.status() != WL_CONNECTED) {
    if (backendConnected) {
      backendConnected = false;
      applyStatusLeds();
    }
    return;
  }

  HTTPClient http;
  WiFiClientSecure client;
  beginHttp(http, client, buildApiUrl("/api/device/status"));
  http.addHeader("X-API-Key", runtimeConfig.apiKey);
  http.addHeader("X-Device-Id", runtimeConfig.deviceId);
  http.addHeader("X-Device-Heartbeat", "true");

  const int responseCode = http.GET();

  if (responseCode != 200) {
    Serial.print("Status poll failed with code: ");
    Serial.println(responseCode);
    if (backendConnected) {
      backendConnected = false;
      applyStatusLeds();
    }
    http.end();
    return;
  }

  const String payload = http.getString();
  DynamicJsonDocument doc(1536);
  const DeserializationError jsonError = deserializeJson(doc, payload);

  if (jsonError) {
    Serial.print("Failed to parse status payload: ");
    Serial.println(jsonError.c_str());
    if (backendConnected) {
      backendConnected = false;
      applyStatusLeds();
    }
    http.end();
    return;
  }

  // Backend responded successfully — mark as connected
  if (!backendConnected) {
    backendConnected = true;
    hasEverConnected  = true;
    applyStatusLeds();
  }

  const bool nextSessionActive = doc["session"]["active"] | false;
  const String nextSessionId = String(doc["session"]["sessionId"] | "");
  const int nextSessionCount = doc["stats"]["sessionAttendance"] | 0;
  const int nextTodayCount = doc["stats"]["todayAttendance"] | 0;

  todayCount = nextTodayCount;

  if (nextSessionActive) {
    const bool sessionChanged = !sessionActive || activeSessionId != nextSessionId;

    sessionActive = true;
    activeSessionId = nextSessionId;
    sessionCount = nextSessionCount;

    if (sessionChanged) {
      previousSessionCount = nextSessionCount;
      sessionStartedFeedback();
      http.end();
      return;
    }

    if (sessionCount > previousSessionCount) {
      studentCheckedIn();
    }

    previousSessionCount = sessionCount;
  } else {
    sessionCount = 0;
    previousSessionCount = 0;

    if (sessionActive) {
      sessionActive = false;
      activeSessionId = "";
      sessionEndedFeedback();
      http.end();
      return;
    }

    activeSessionId = "";
  }

  http.end();
}
