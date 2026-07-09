import { setSession } from './auth.js';
import { showToast } from './utils.js';

const form = document.getElementById('register-form');
const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const pwdInput = document.getElementById('password');
const roleSelect = document.getElementById('role');

function validateEmail(v){ if(!v) return 'Email required'; if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Enter valid email'; return ''; }
function validatePassword(v){ if(!v) return 'Password required'; if(v.length<4) return 'Password too short'; return ''; }

form?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const pwd = pwdInput.value;
  const role = roleSelect.value || 'role_nurse';
  
  // ...
  
  try{
    const res = await fetch('/api/register', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ name, email, role_id: role, password: pwd }) });
    const data = await res.json();
    if (res.status === 201 && data.ok){
      setSession(data.user, data.token, true);
      showToast('Account created — you are signed in', 'success');
      setTimeout(()=> location.replace('/index.html'), 700);
      return;
    }
    showToast(data.error || 'Registration failed', 'error');
  }catch(err){
    console.error('Register error', err);
    showToast('Network error while registering', 'error');
  }
});
