
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/database";

const firebaseConfig = {
  apiKey: "AIzaSyDR7o8acW_Ra5ttaDjmzlRxD2A6_CFLoWY",
  authDomain: "tv-app-c8a76.firebaseapp.com",
  databaseURL: "https://tv-app-c8a76-default-rtdb.firebaseio.com",
  projectId: "tv-app-c8a76",
  storageBucket: "tv-app-c8a76.firebasestorage.app",
  messagingSenderId: "257469511225",
  appId: "1:257469511225:web:c7801b2f9802e983f87fe8",
  measurementId: "G-SZKGT1CHY4"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export const db = firebase.database();
