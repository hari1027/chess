import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyCJg3P59Qf23woiBC6nGnykVFuec2XOUn8",
    authDomain: "chess-88cee.firebaseapp.com",
    projectId: "chess-88cee",
    storageBucket: "chess-88cee.firebasestorage.app",
    messagingSenderId: "485903740985",
    appId: "1:485903740985:web:d308ce05494ae049511de8",
    measurementId: "G-Z7FQK2T1RS"
  };
  
  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);

  export const db = firebase.firestore()
  export const auth = firebase.auth()
  export default firebase;