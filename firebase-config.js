// ============================================================
// PASTE YOUR OWN FIREBASE PROJECT CONFIG BELOW.
// Get this from: Firebase Console → Project Settings → Your apps → SDK setup
// See README.md for full step-by-step instructions.
// ============================================================
const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_PROJECT.firebaseapp.com",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_PROJECT.appspot.com",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
