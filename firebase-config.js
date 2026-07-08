// ============================================================
// Step Media Ltd — Board Stock System
// Connected to Firebase project: stepmedia-stock
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyAsNBlM-7M3MBLoOzmeyyOfi0pcnig58hA",
  authDomain: "stepmedia-stock.firebaseapp.com",
  projectId: "stepmedia-stock",
  storageBucket: "stepmedia-stock.firebasestorage.app",
  messagingSenderId: "888494897735",
  appId: "1:888494897735:web:9fce12bae40c18295cf62",
  measurementId: "G-JD403BKW7C"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
