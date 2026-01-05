const { initializeApp } = require("firebase/app");
const { getFirestore } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyCkYUn1FesWQsu3R0QvE0kil_7XiKTSJLE",
  authDomain: "kalivra-30492.firebaseapp.com",
  databaseURL: "https://kalivra-30492-default-rtdb.firebaseio.com",
  projectId: "kalivra-30492",
  storageBucket: "kalivra-30492.firebasestorage.app",
  messagingSenderId: "384205349260",
  appId: "1:384205349260:web:ed28f2b36c74d9bf03f6a9",
  measurementId: "G-8GQ9MPQD0J"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

module.exports = { db };