// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🔴 COLE AQUI SUA CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyDfLH1F1mHODiSsgbcVtn9_BzwzSiy8NC0",
    authDomain: "medcontrol-b4908.firebaseapp.com",
    projectId: "medcontrol-b4908",
    storageBucket: "medcontrol-b4908.firebasestorage.app",
    messagingSenderId: "672551150430",
    appId: "1:672551150430:web:8a7f4341cd0ad0252565cf"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// exports úteis
export {
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    query,
    orderBy
};
