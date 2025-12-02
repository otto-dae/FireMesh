#pragma once

#include <Firebase_ESP_Client.h>

using namespace std;

class FireBaseCon{
    public:

    FirebaseData* fbdo;
    FirebaseAuth* auth;  
    FirebaseConfig* config;  
    bool firebaseReady = false; 

    FireBaseCon(
                string& _firebaseAPI,
                string& _firebaseAuthDomain,
                string& _firebaseDatabaseUrl,
                string& _firebaseProjectId,
                string& _firebaseStorageBucket,
                string& _firebaseMessaginSenderId,
                string& _firebaseAppId
    );

    ~FireBaseCon() = default;

    void enviarAFirebase(int humo, int fuego, unsigned long long ts, String tipo, uint32_t nodeId);
    void setupFirebase();
    
    private:
        string firebaseAPI;
        string firebaseAuthDomain;
        string firebaseDatabaseUrl;
        string firebaseProjectId;
        string firebaseStorageBucket;
        string firebaseMessaginSenderId;
        string firebaseAppI;
};