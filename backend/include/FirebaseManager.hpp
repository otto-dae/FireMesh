#ifndef FIREBASE_MANAGER_H
#define FIREBASE_MANAGER_H

#include <Firebase_ESP_Client.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

class FirebaseManager {
private:
    FirebaseData fbdo;
    FirebaseAuth auth;
    FirebaseConfig config;
    bool ready;

public:
    FirebaseManager();
    bool begin(const char* apiKey, const char* dbURL, const char* email, const char* password);
    bool isReady();
    bool sendData(int humo, int fuego, unsigned long long ts, String tipo, uint32_t nodeId);
    void reconnect();
};

#endif