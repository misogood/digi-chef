const chatBox = document.getElementById('chat-box');
const inputVeld = document.getElementById('user-input');
const stuurKnop = document.getElementById('stuur-knop');


function voegBerichtToe(rol, tekst) {
    const div = document.createElement('div');
    
    
    div.classList.add('bubble');
    

    if (rol === 'chef') {
        div.classList.add('bot-bubble');
     
        div.innerHTML = marked.parse(tekst);
    } else {
        div.classList.add('user-bubble');
        div.textContent = tekst;
    }
    
    chatBox.appendChild(div);
    
    // Automatisch naar beneden scrollen bij nieuwe berichten :)
    chatBox.scrollTop = chatBox.scrollHeight;
}

async function stuurBericht() {
    const bericht = inputVeld.value.trim();
    if (!bericht) return;

    // submt button inactief maken tijdens het verwerken van de prompt
    stuurKnop.disabled = true;
    stuurKnop.innerText = "Nadenken...";
    
    voegBerichtToe('user', bericht);
    inputVeld.value = '';

    try {
        
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: bericht })
        });
        
        const data = await response.json();
        
        
        voegBerichtToe('chef', data.reply);

    } catch (error) {
        
        voegBerichtToe('chef', "Oeps, de oven staat in brand! (Er ging iets mis met de server).");
    } finally {
       
        stuurKnop.disabled = false;
        stuurKnop.innerText = "Stuur";
    }
}

// Event listeners voor de knop en de Enter-toets
stuurKnop.addEventListener('click', stuurBericht);
inputVeld.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') stuurBericht();
});