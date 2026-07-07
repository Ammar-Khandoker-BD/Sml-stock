// ============================================================
// PASTE YOUR OWN FIREBASE PROJECT CONFIG BELOW.
// Get this from: Firebase Console → Project Settings → Your apps → SDK setup
// See README.md for full step-by-step instructions.
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyAsNBlM-7M3MBLoOzmeyyOfi0pcnig58hA",
  authDomain: "stepmedia-stock.firebaseapp.com",
  projectId: "stepmedia-stock",
  storageBucket: "stepmedia-stock.firebasestorage.app",
  messagingSenderId: "888494897735",
  appId: "1:888494897735:web:9fce12bae640c18295cf62",


firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
