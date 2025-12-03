#include "FirebaseManager.hpp"
#include <Firebase_ESP_Client.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

FirebaseManager::FirebaseManager() : ready(false) {}

FirebaseManager::~FirebaseManager() {}

bool FirebaseManager::begin(const char* apiKey, const char* dbURL, const char* email, const char* password) {
    Serial.println("\n[Firebase] Configurando...");

    config.api_key = apiKey;
    config.database_url = dbURL;

    auth.user.email = email;
    auth.user.password = password;

    config.token_status_callback = tokenStatusCallback;
    config.timeout.serverResponse = 15000;
    config.timeout.socketConnection = 10000;

    Firebase.begin(&config, &auth);
    Firebase.reconnectWiFi(true);

    int timeout = 0;
    while (!Firebase.ready() && timeout < 30) {
        delay(500);
        Serial.print(".");
        timeout++;
    }

    if (Firebase.ready()) {
        ready = true;
        Serial.println("\n[Firebase] Conectado correctamente.");
        return true;
    } else {
        ready = false;
        Serial.println("\n[Firebase] Falló autenticación.");
        return false;
    }
}

bool FirebaseManager::isReady() {
    return ready && Firebase.ready();
}

bool FirebaseManager::sendData(int humo, int fuego, unsigned long long ts, String tipo, uint32_t nodeId) {
    if (!isReady()) return false;

    FirebaseJson json;
    json.set("humo", humo);
    json.set("fuego", fuego);
    json.set("timestamp", (double)ts);
    json.set("type", tipo);
    json.set("nodeId", (int)nodeId);
    json.set("serverTimestamp", (double)millis());

    String path = "sensores/node_";
    path += nodeId;
    path += "/lecturas";

    if (Firebase.RTDB.pushJSON(&fbdo, path.c_str(), &json)) {
        return true;
    } else {
        Serial.printf("[Firebase] Error: %s\n", fbdo.errorReason().c_str());
        return false;
    }
}

void FirebaseManager::reconnect() {
    Firebase.reconnectWiFi(true);
}
