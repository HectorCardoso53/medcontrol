import { auth } from "./auth.js";

import {
signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const form = document.getElementById("formLogin");
const progress = document.getElementById("loginProgress");
const bar = document.getElementById("loginBar");

form.addEventListener("submit", async (e)=>{

e.preventDefault();

const email = document.getElementById("email").value;
const senha = document.getElementById("senha").value;

// mostra barra
progress.style.display = "block";
bar.style.width = "0%";

let largura = 0;

const anim = setInterval(()=>{
largura += 10;

if(largura <= 90){
bar.style.width = largura + "%";
}

},150);

try{

await signInWithEmailAndPassword(auth,email,senha);

// completa barra
clearInterval(anim);
bar.style.width = "100%";

// pequena pausa para UX
setTimeout(()=>{
window.location.href = "home.html";
},600);

}catch(err){

clearInterval(anim);

progress.style.display = "none";
bar.style.width = "0%";

alert("Email ou senha inválidos");

}

});