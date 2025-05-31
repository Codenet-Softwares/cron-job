import admin from 'firebase-admin';
import serviceAccount from '../firebase.json' assert { type: "json" };

const initializeFirebase = () => {
  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('Firebase Admin SDK initialized successfully');
    } else {
      console.log('Firebase already initialized');
    }

    return admin.firestore();
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
    throw error;
  }
};

export const db = initializeFirebase();
