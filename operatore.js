// ===========================================
// CONFIGURAZIONE SUPABASE
// ===========================================
const SUPABASE_URL = 'https://jukyggaoiekenvekoicv.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1a3lnZ2FvaWVrZW52ZWtvaWN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwNjEwOTgsImV4cCI6MjA3MjYzNzA5OH0.84lO4yqqZ6pbVLX0hlxOC3qgK508y1gFxeSp3Wx3kkw'; 

if (!window.supabaseClient) {
    if (typeof window.supabase !== 'undefined') {
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
}
var supabase = window.supabaseClient;

// --- VARIABILI GLOBALI ---
let ordineSelezionatoId = null; 
let ordiniGlobali = []; // Contiene TUTTI i dati scaricati dal DB

// ===========================================
// 1. VERIFICA PERMESSI OPERATORE
// ===========================================
async function verificaOperatore() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = 'login.html'; return; }

    const { data: profilo, error } = await supabase
        .from('utenti')
        .select('permessi')
        .eq('id', user.id)
        .single();

    if (error || !profilo || profilo.permessi !== 'operatore') {
        alert("Accesso Negato: Area riservata agli operatori.");
        await supabase.auth.signOut();
        window.location.href = 'login.html';
        return;
    }
    caricaTuttiGliOrdini();
}

// ===========================================
// 2. CARICAMENTO ORDINI DAL DB
// ===========================================
async function caricaTuttiGliOrdini() {
    const loading = document.getElementById('loadingMessage');
    const table = document.getElementById('tabellaOrdini');
    
    if(loading) loading.style.display = 'block';
    if(table) table.style.display = 'none';

    const { data: ordini, error } = await supabase
        .from('ordini')
        .select('*')
        .order('data_ordine', { ascending: false });

    if (error) {
        if(loading) loading.textContent = "Errore caricamento ordini: " + error.message;
        return;
    }

    // Salviamo i dati nella variabile globale
    ordiniGlobali = ordini;

    //richiamo la funzone per il calcolo degli ordini rimanenti da evadere
    aggiornaConteggioDaEvadereOperatore();

    // Disegniamo la tabella applicando i filtri (inizialmente vuoti = mostra tutto)
    applicaFiltri(); 
    
    if(loading) loading.style.display = 'none';
    if(table) table.style.display = 'table';
}



//----------inizio funzione per contare gli ordini da evadere-------------------
function aggiornaConteggioDaEvadereOperatore() {
    const countSpan = document.getElementById('countOrdiniDaEvadereOperatore');
    if (!countSpan) return;

    // Array con gli stati specifici da conteggiare
    const statiDaEvadere = [
        'Richiesta Inviata', 
        'In attesa di lavorazione', 
        'In lavorazione', 
        'Fare Bozza',
        'Modificare Bozza',
        'Bozza Inviata',
        'Bozza Confermata',
        'Merce Ordinata',
        'Attesa Pagamento', 
        'Convalida Commerciale'
    ];

    // Filtriamo e contiamo solo gli ordini che hanno uno degli stati elencati
    const daEvadere = ordiniGlobali.filter(o => statiDaEvadere.includes(o.stato)).length;
    
    countSpan.textContent = daEvadere;
}

//-----------fine funzione con richiami in ordinidacaricare()--------------


// ===========================================
// 2a. FUNZIONE DI FILTRAGGIO
// ===========================================
function applicaFiltri() {
    const testo = document.getElementById('filtroTesto').value.toLowerCase().trim();
    const stato = document.getElementById('filtroStato').value;
    const dataInizio = document.getElementById('filtroDataInizio').value;
    const dataFine = document.getElementById('filtroDataFine').value;

    const ordiniFiltrati = ordiniGlobali.filter(ordine => {
        // 1. Filtro Testo (ID, Riferimento, Nome Cliente nel DB)
        let matchTesto = true;
        if (testo) {
            const numOrdine = (ordine.num_ordine_prog || ordine.id).toLowerCase();
            
            // Estrazione Riferimento JSON
            let riferimento = "";
            if (ordine.dettagli_prodotti && Array.isArray(ordine.dettagli_prodotti)) {
                const info = ordine.dettagli_prodotti.find(i => i.tipo === 'INFO_CLIENTE');
                if (info && info.cliente) riferimento = info.cliente.toLowerCase();
            }

            matchTesto = numOrdine.includes(testo) || riferimento.includes(testo);
        }

        // 2. Filtro Stato
        let matchStato = true;
        if (stato) {
            matchStato = ordine.stato === stato;
        }

        // 3. Filtro Data
        let matchData = true;
        const dataOrdine = new Date(ordine.data_ordine); // Data ordine dal DB
        
        if (dataInizio) {
            const dInizio = new Date(dataInizio);
            dInizio.setHours(0,0,0,0); // Azzera orario
            if (dataOrdine < dInizio) matchData = false;
        }
        
        if (dataFine) {
            const dFine = new Date(dataFine);
            dFine.setHours(23,59,59,999); // Fine giornata
            if (dataOrdine > dFine) matchData = false;
        }

        return matchTesto && matchStato && matchData;
    });

    renderOrdini(ordiniFiltrati);
}

// ===========================================
// 2b. FUNZIONE DI RENDERING (DISEGNO TABELLA)
// ===========================================
function renderOrdini(lista) {
    const tbody = document.getElementById('listaOrdiniBody');
    tbody.innerHTML = '';

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nessun ordine trovato con questi criteri.</td></tr>';
        return;
    }
    
    lista.forEach(ordine => {
        const numOrdine = ordine.num_ordine_prog || ordine.id.substring(0, 8).toUpperCase();
        const dataFmt = new Date(ordine.data_ordine).toLocaleString();
        
        // Estrazione nome cliente / riferimento
        let nomeCliente = '<span style="color: #999;">N/D</span>';
        if (ordine.dettagli_prodotti && Array.isArray(ordine.dettagli_prodotti)) {
            const info = ordine.dettagli_prodotti.find(item => item.tipo === 'INFO_CLIENTE');
            if (info && info.cliente) {
                nomeCliente = `<strong style="color:#0056b3;">${info.cliente}</strong>`;
            }
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${numOrdine}</td>
            <td>${dataFmt}</td>
            <td>${nomeCliente}</td>
            <td><span class="stato-${ordine.stato.replace(/\s/g, '-')}">${ordine.stato}</span></td>
            <td>
                <div id="nota-preview-${ordine.id}" 
         style="cursor:pointer; max-width:150px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#007bff; text-decoration:underline;"
         onclick="apriModaleNota('${ordine.id}', \`${(ordine.note_condivise || '').replace(/`/g, '\\`').replace(/\n/g, '\\n')}\`)">
        ${ordine.note_condivise ? ordine.note_condivise : '➕'}
                </div>
            </td>
            <td>
                <button class="btn-info" onclick="apriDettagliPreventivo('${ordine.id}')">
                    📄 
                </button>
                <button class="btn-edit" onclick="apriModaleModifica('${ordine.id}', '${numOrdine}', '${ordine.stato}')">
                    ✏️ 
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}
/*
------------------------------------------------------------------------------
// ===========================================
// 3. FUNZIONE: APRI DETTAGLI + TASTO STAMPA
// ===========================================
window.apriDettagliPreventivo = function(id) {
    const ordine = ordiniGlobali.find(o => o.id === id);
    if (!ordine) return;

    const dettagli = ordine.dettagli_prodotti;
    const container = document.getElementById('contenutoDettagli');
    let html = "";

    // --- 1. BOX BLU DATI CLIENTE ---
    const infoCliente = dettagli.find(d => d.tipo === 'INFO_CLIENTE');
    if (infoCliente) {
        html += `<div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #007bff; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">`;
        html += `<h4 style="margin-top: 0; margin-bottom: 10px; color: #333;">👤 Riferimento Cliente</h4>`;
        html += `<strong>Nome / Rag. Soc.:</strong> ${infoCliente.cliente || '---'}<br>`;
        html += `<strong>Contatti:</strong> ${infoCliente.contatti || '---'}`;
        html += `</div>`;
    }

    // --- 2. TABELLA PRODOTTI ---
    html += `<h4 style="margin:0 0 10px 0; color:#007bff; text-align:left;">📋 Distinta Articoli da Produrre</h4>`;
    
    html += `<div style="overflow-x:auto;">
    <table style="width:100%; border-collapse:collapse; margin-bottom:20px; font-family:inherit; table-layout: fixed;">
        <thead>
            <tr style="background-color:#e9ecef; color:#495057;">
                <th style="padding:10px; text-align:left; border:1px solid #dee2e6; width: 60%;">Articolo & Specifiche</th>
                <th style="padding:10px; text-align:center; border:1px solid #dee2e6; width: 15%;">Qtà</th>
                <th style="padding:10px; text-align:center; border:1px solid #dee2e6; width: 25%;">File Allegato</th>
            </tr>
        </thead>
        <tbody>`;

    dettagli.forEach(item => {
        // Saltiamo le info cliente
        if (item.tipo === 'INFO_CLIENTE') return;

        let specs = '';
        
        // Componenti
        if (item.componenti && item.componenti.length > 0) {
            specs += `<div style="font-size:0.85em; margin-top:5px; color:#555; text-align:left;">🔹 ${item.componenti.join('<br>🔹 ')}</div>`;
        }
        
        // Taglie
        if (item.dettagli_taglie && Object.keys(item.dettagli_taglie).length > 0) {
            specs += `<div style="font-size:0.85em; margin-top:5px; color:#007bff; text-align:left;"><strong>Taglie:</strong> `;
            for (const genere in item.dettagli_taglie) {
                const t = Object.entries(item.dettagli_taglie[genere]).map(([k,v])=>`<b>${k}</b>:${v}`).join(' | ');
                specs += `<div style="margin-top: 2px;">${genere}: [${t}]</div>`;
            }
            specs += `</div>`;
        }

        // Note Articolo
        if (item.note && item.note.trim() !== '') {
            specs += `<div style="font-size:0.85em; margin-top:5px; color:#dc3545; text-align:left;"><em>Note: ${item.note}</em></div>`;
        }

        // Bottone Download File
        let fileCell = '<span style="color:#ccc;">-</span>';
        if (item.personalizzazione_url && item.personalizzazione_url !== 'Nessun file collegato direttamente.') {
            if (item.personalizzazione_url.includes('http')) {
                fileCell = `<a href="${item.personalizzazione_url}" target="_blank" style="display:inline-block; padding:6px 12px; background:#28a745; color:white; border-radius:4px; text-decoration:none; font-weight:bold; font-size:0.85em; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: background 0.3s;">📥 Apri File</a>`;
            } else {
                fileCell = `<span style="font-size: 0.85em; color: #555;">${item.personalizzazione_url}</span>`;
            }
        }

        // Creazione Riga
        html += `
            <tr style="border-bottom: 1px solid #dee2e6; background-color: #fff;">
                <td style="padding:12px 10px; border:1px solid #dee2e6; vertical-align:top; text-align:left; word-wrap: break-word;">
                    <div style="font-weight:bold; color:#333; font-size: 1.05em;">${item.prodotto}</div>
                    ${specs}
                </td>
                <td style="padding:12px 10px; border:1px solid #dee2e6; text-align:center; vertical-align:top; font-weight:bold; font-size: 1.2em; color: #007bff;">${item.quantita}</td>
                <td style="padding:12px 10px; border:1px solid #dee2e6; text-align:center; vertical-align:middle;">${fileCell}</td>
            </tr>`;
    });

    html += `</tbody></table></div>`;

    container.innerHTML = html;

    // --- TASTO STAMPA ---
    // 1. Rimuoviamo eventuali vecchi bottoni
    const vecchioBtn = document.getElementById('btnStampaOperatore');
    if (vecchioBtn) vecchioBtn.remove();

    // 2. Creiamo il bottone
    const btnStampa = document.createElement('button');
    btnStampa.id = 'btnStampaOperatore';
    btnStampa.textContent = '🖨️ Stampa Dettagli';
    
    btnStampa.style.marginTop = '15px';
    btnStampa.style.padding = '10px 20px';
    btnStampa.style.backgroundColor = '#6c757d'; 
    btnStampa.style.color = 'white';
    btnStampa.style.border = 'none';
    btnStampa.style.borderRadius = '5px';
    btnStampa.style.cursor = 'pointer';
    btnStampa.style.fontSize = '1rem';
    btnStampa.style.float = 'right'; 
    
    btnStampa.onclick = function() { window.print(); };

    // 3. Inseriamo il bottone
    container.parentNode.insertBefore(btnStampa, container.nextSibling);

    document.getElementById('modalDettagli').style.display = 'flex';
}*/
// ===========================================
// 3. FUNZIONE: APRI DETTAGLI + TASTO STAMPA (Stile Tabellare A4)
// ===========================================
window.apriDettagliPreventivo = function(id) {
    const ordine = ordiniGlobali.find(o => o.id === id);
    if (!ordine) return;

    const dettagli = ordine.dettagli_prodotti;
    const container = document.getElementById('contenutoDettagli');
    const numOrdineVisibile = ordine.num_ordine_prog || ordine.id.substring(0, 8).toUpperCase();
    
    // --- FIX IMPORTANTE PER IL LAYOUT ---
    container.style.whiteSpace = 'normal'; 

    const logoHtml = `<img src="icon-192.png" alt="Logo" style="height: 45px; vertical-align: middle; margin-right: 15px;">`;

    let html = "";
// --- INIEZIONE STILE STAMPA FULL WIDTH A4 (CON FIX SCROLLBAR E PAGINAZIONE) ---
    html += `
    <style>
        /* --- 1. ALLARGA IL MODALE SULLO SCHERMO --- */
        @media screen {
            #modalDettagli .modal-content {
                max-width: 1000px !important; /* Allarga il modale rispetto al default */
                width: 85% !important;
            }
        }

        /* --- 2. STILE STAMPA FULL WIDTH A4 (CON FIX SCROLLBAR E PAGINAZIONE) --- */
        @media print {
            @page { 
                margin: 0.5cm; 
            }
            body * { 
                visibility: hidden; 
            }
            #modalDettagli, #modalDettagli * { 
                visibility: visible; 
            }
            
            /* Sgancia il modale e lo fa espandere all'infinito */
            #modalDettagli {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                height: auto !important;
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
                display: block !important; /* Fondamentale: sovrascrive il display: flex che blocca i fogli multipli */
                overflow: visible !important;
            }
            
            /* Rimuove i blocchi di altezza e le barre di scorrimento interne */
            .modal-content, #contenutoDettagli {
                width: 100% !important;
                max-width: 100% !important;
                height: auto !important;
                max-height: none !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                box-shadow: none !important;
                overflow: visible !important;
            }
            
            /* Evita che una riga della tabella venga segata a metà tra un foglio e l'altro */
            tr { 
                page-break-inside: avoid; 
            }
            
            /* Nasconde i pulsanti */
            .close-button, #btnStampaOperatore, button { 
                display: none !important; 
            }
        }
    </style>
    `;

    // --- TITOLO E LOGO ---
    html += `<h2 style="margin-top: 0; border-bottom: 2px solid #eee; padding-bottom: 10px; display: flex; align-items: center;">
                ${logoHtml} Distinta di Produzione: <span style="color: #007bff; margin-left: 8px;">${numOrdineVisibile}</span>
             </h2>`;

    // --- BOX BLU DATI CLIENTE E RIFERIMENTO DB ---
    html += `<div style="font-size: 0.85em; color: #999; margin-bottom: 5px;">Rif. Database: ${ordine.id}</div>`;

    const infoCliente = dettagli.find(d => d.tipo === 'INFO_CLIENTE');
    if (infoCliente) {
        html += `<div style="background: #f1f8ff; padding: 10px; border-radius: 5px; margin-bottom: 15px; border: 1px solid #cce5ff;">`;
        html += `<strong>Cliente / Rag. Soc.:</strong> ${infoCliente.cliente || '---'}<br>`;
        html += `<strong>Contatti:</strong> ${infoCliente.contatti || '---'}`;
        html += `</div>`;
    }


    // --- TABELLA PRODOTTI ---
    html += `<h4 style="margin:0 0 10px 0; color:#007bff; text-align:left;">📋 Dettaglio Articoli da Produrre</h4>`;
    
    html += `<div style="overflow-x:auto;">
    <table style="width:100%; border-collapse:collapse; margin-bottom:20px; font-family:inherit; table-layout: fixed;">
        <thead>
            <tr style="background-color:#e9ecef; color:#495057;">
                <th style="padding:10px; text-align:left; border:1px solid #dee2e6; width: 65%;">Articolo & Specifiche</th>
                <th style="padding:10px; text-align:center; border:1px solid #dee2e6; width: 15%;">Qtà</th>
                <th style="padding:10px; text-align:center; border:1px solid #dee2e6; width: 20%;">Allegato</th>
            </tr>
        </thead>
        <tbody>`;

    dettagli.forEach(item => {
        if (item.tipo === 'INFO_CLIENTE') return;

        let specs = '';
        
        // Componenti
        if (item.componenti && item.componenti.length > 0) {
            specs += `<div style="font-size:0.85em; margin-top:3px; color:#555; text-align:left;">🔹 ${item.componenti.join('<br>🔹 ')}</div>`;
        }
        
        // Taglie
        if (item.dettagli_taglie && Object.keys(item.dettagli_taglie).length > 0) {
            specs += `<div style="font-size:0.85em; margin-top:3px; color:#007bff; text-align:left;"><strong>Taglie:</strong> `;
            for (const g in item.dettagli_taglie) {
                const t = Object.entries(item.dettagli_taglie[g]).map(([k,v])=>`${k}:${v}`).join(' | ');
                specs += `<br>&nbsp;&nbsp;${g} [${t}] `;
            }
            specs += `</div>`;
        }

        // Note Operative
        if (item.note && item.note.trim() !== '') {
            specs += `<div style="font-size:0.85em; margin-top:3px; color:#dc3545; text-align:left;"><em>Note: ${item.note}</em></div>`;
        }

        // Gestione Bottone File
        let fileCell = '<span style="color:#ccc;">-</span>';
        if (item.personalizzazione_url && item.personalizzazione_url !== 'Nessun file collegato direttamente.' && item.personalizzazione_url !== 'Nessun file caricato') {
            if (item.personalizzazione_url.includes('http')) {
                fileCell = `<a href="${item.personalizzazione_url}" target="_blank" style="display:inline-block; padding:5px 10px; background:#007bff; color:white; border-radius:4px; text-decoration:none; font-weight:bold; font-size:0.8em; white-space:nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">📥 Apri</a>`;
            } else {
                fileCell = `<div style="font-size:0.8em; word-wrap:break-word;">${item.personalizzazione_url}</div>`;
            }
        }

        html += `
            <tr>
                <td style="padding:10px; border:1px solid #dee2e6; vertical-align:top; text-align:left; word-wrap: break-word;">
                    <div style="font-weight:bold; color:#333; font-size: 1.1em;">${item.prodotto}</div>
                    ${specs}
                </td>
                <td style="padding:10px; border:1px solid #dee2e6; text-align:center; vertical-align:top; font-weight:bold; font-size:1.2em;">${item.quantita}</td>
                <td style="padding:10px; border:1px solid #dee2e6; text-align:center; vertical-align:top;">${fileCell}</td>
            </tr>`;
    });

    html += `</tbody></table></div>`;

    

    // ==========================================
    // INIZIO NUOVO BLOCCO: BOX NOTE CONDIVISE
    // ==========================================
    if (ordine.note_condivise && ordine.note_condivise.trim() !== '') {
        // Sostituiamo i ritorni a capo testuali con il tag <br> per l'HTML
        const noteFormattate = ordine.note_condivise.replace(/\n/g, '<br>');
        
        html += `
        <div style="background-color: #fff3cd !important; border: 1px solid #ffe69c !important; color: #664d03; padding: 15px; border-radius: 5px; margin-bottom: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
            <strong style="font-size: 1.1em; display:block; margin-bottom: 5px;">📌 Note Operative Condivise:</strong>
            <div style="font-size: 1.05em;">${noteFormattate}</div>
        </div>`;
    }
    // ==========================================
    // FINE NUOVO BLOCCO
    // ==========================================


    


    

    container.innerHTML = html;

    // --- TASTO STAMPA ---
    const vecchioBtn = document.getElementById('btnStampaOperatore');
    if (vecchioBtn) vecchioBtn.remove();

    const btnStampa = document.createElement('button');
    btnStampa.id = 'btnStampaOperatore';
    btnStampa.textContent = '🖨️ Stampa Distinta Produzione';
    
    btnStampa.style.marginTop = '15px';
    btnStampa.style.padding = '10px 20px';
    btnStampa.style.backgroundColor = '#6c757d'; 
    btnStampa.style.color = 'white';
    btnStampa.style.border = 'none';
    btnStampa.style.borderRadius = '5px';
    btnStampa.style.cursor = 'pointer';
    btnStampa.style.fontSize = '1rem';
    btnStampa.style.float = 'right'; 
    
    btnStampa.onclick = function() { window.print(); };

    container.parentNode.insertBefore(btnStampa, container.nextSibling);

    document.getElementById('modalDettagli').style.display = 'flex';
}







// ===========================================
// 4. GESTIONE MODALE STATO
// ===========================================
window.apriModaleModifica = function(id, numProg, statoAttuale) {
    ordineSelezionatoId = id;
    document.getElementById('modalOrderIdLabel').textContent = numProg;
    document.getElementById('nuovoStatoSelect').value = statoAttuale;
    document.getElementById('modalStato').style.display = 'flex';
}

document.getElementById('btnSalvaStato').addEventListener('click', async () => {
    if (!ordineSelezionatoId) return;
    const nuovoStato = document.getElementById('nuovoStatoSelect').value;
    
    // Aggiorna stato su Supabase
    const { error } = await supabase
        .from('ordini')
        .update({ stato: nuovoStato })
        .eq('id', ordineSelezionatoId);

    if (error) {
        alert("Errore: " + error.message);
    } else {
        document.getElementById('modalStato').style.display = 'none';
        caricaTuttiGliOrdini(); // Ricarica tabella e riapplica i filtri (via render)
    }
});

// ===========================================
// EVENT LISTENERS GENERALI (DOM Ready)
// ===========================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Avvio verifica operatore
    verificaOperatore();
    
    // 2. Listener Logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = 'login.html';
    });

    // 3. Listener Chiusura Modali
    document.getElementById('closeModalStato').addEventListener('click', () => {
        document.getElementById('modalStato').style.display = 'none';
    });
    document.getElementById('closeModalDettagli').addEventListener('click', () => {
        document.getElementById('modalDettagli').style.display = 'none';
    });
    
    // Chiudi cliccando fuori
    window.addEventListener('click', (e) => {
        const mStato = document.getElementById('modalStato');
        const mDett = document.getElementById('modalDettagli');
        if (e.target === mStato) mStato.style.display = 'none';
        if (e.target === mDett) mDett.style.display = 'none';
    });

    // 4. Listener Filtri
    const btnApplica = document.getElementById('btnApplicaFiltri');
    if(btnApplica) btnApplica.addEventListener('click', applicaFiltri);

    const inputTesto = document.getElementById('filtroTesto');
    if(inputTesto) {
        inputTesto.addEventListener('keyup', (e) => {
            if(e.key === 'Enter') applicaFiltri();
        });
    }
    
    const btnReset = document.getElementById('btnResetFiltri');
    if(btnReset) {
        btnReset.addEventListener('click', () => {
            document.getElementById('filtroTesto').value = '';
            document.getElementById('filtroStato').value = '';
            document.getElementById('filtroDataInizio').value = '';
            document.getElementById('filtroDataFine').value = '';
            applicaFiltri();
        });
    }

    controllaStatoNotifiche();
});


// funzione per aggiungere nota rapida da operatore
window.salvaNotaRapida = async function(ordineId, nuovoTesto) {
    console.log("Salvataggio nota per ordine:", ordineId);
    
    const { error } = await supabase
        .from('ordini')
        .update({ note_condivise: nuovoTesto })
        .eq('id', ordineId);

    if (error) {
        alert("Errore nel salvataggio della nota: " + error.message);
    } else {
        // Feedback visivo rapido: facciamo diventare il bordo verde per un secondo
        const input = document.activeElement;
        if (input) {
            input.style.borderColor = "#28a745";
            setTimeout(() => { input.style.borderColor = "#ddd"; }, 2000);
        }
    }
};

// Funzione per aprire il modale e caricare la nota
window.apriModaleNota = function(id, testo) {
    ordineSelezionatoId = id; // Usa la variabile globale già esistente
    document.getElementById('textareaNota').value = testo;
    document.getElementById('modalNotaEstesa').style.display = 'flex';
};

// Funzione per salvare la nota dal modale
document.getElementById('btnSalvaNotaEstesa').addEventListener('click', async () => {
    const nuovaNota = document.getElementById('textareaNota').value;
    
    const { error } = await supabase
        .from('ordini')
        .update({ note_condivise: nuovaNota })
        .eq('id', ordineSelezionatoId);

    if (error) {
        alert("Errore nel salvataggio: " + error.message);
    } else {
        document.getElementById('modalNotaEstesa').style.display = 'none';
        // Aggiorniamo l'anteprima nella tabella senza ricaricare tutto
        const preview = document.getElementById(`nota-preview-${ordineSelezionatoId}`);
        if (preview) {
            preview.innerText = nuovaNota ? nuovaNota : '➕ Aggiungi nota';
        }
        // Aggiorniamo anche l'array globale per coerenza
        const ordine = ordiniGlobali.find(o => o.id === ordineSelezionatoId);
        if (ordine) ordine.note_condivise = nuovaNota;
    }
});
//-------------fine modale aggiunzione nota


//--------------inizio funzione gestione ordini da evadere
document.addEventListener('DOMContentLoaded', () => {
    const btnOrdini = document.getElementById('boxOrdiniDaEvadereOperatore');
    const modalEvadere = document.getElementById('ordiniDaEvadereModal');
    const closeBtn = document.getElementById('closeOrdiniDaEvadereModalBtn');
    const tableBody = document.getElementById('ordiniDaEvadereTableBody');

    // Array degli stati da evadere (uguale all'admin)
    const statiDaEvadere = [
        'Richiesta Inviata', 'In attesa di lavorazione', 'In lavorazione', 
        'Fare Bozza', 'Modificare Bozza', 'Bozza Inviata', 
        'Bozza Confermata', 'Merce Ordinata', 'Attesa Pagamento', 'Convalida Commerciale'
    ];

    if (btnOrdini && modalEvadere) {
        btnOrdini.onclick = function() {
            modalEvadere.style.display = 'flex';
            tableBody.innerHTML = '';

            // Usa l'array globale degli ordini (fallback di sicurezza se ha un nome diverso)
            const ordiniSource = typeof ordiniGlobali !== 'undefined' ? ordiniGlobali : [];
            const ordiniDaMostrare = ordiniSource.filter(o => statiDaEvadere.includes(o.stato));

            if (ordiniDaMostrare.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:20px;">Nessun ordine da evadere.</td></tr>';
                return;
            }

            ordiniDaMostrare.forEach(ordine => {
                let riferimentoCliente = "---";
                if (ordine.dettagli_prodotti && Array.isArray(ordine.dettagli_prodotti)) {
                    const info = ordine.dettagli_prodotti.find(d => d.tipo === 'INFO_CLIENTE');
                    if (info && info.cliente) riferimentoCliente = info.cliente;
                }

                const accountNome = ordine.utente?.ragione_sociale || 'N/D';
                const pIva = ordine.utente?.partita_iva || 'N/D';
                const numeroOrdine = ordine.num_ordine_prog || (ordine.id ? ordine.id.substring(0, 8).toUpperCase() : '-');

                const tr = document.createElement('tr');
                tr.style.borderBottom = "1px solid #eee";
                tr.innerHTML = `
                    <td style="padding:12px 10px; font-weight:bold;">${numeroOrdine}</td>
                    <td style="padding:12px 10px;">${accountNome}</td>
                    <td style="padding:12px 10px; font-weight:bold; color:#007bff;">${riferimentoCliente}</td>
                    <td style="padding:12px 10px;">${pIva}</td>
                    <td style="padding:12px 10px;">${ordine.data_ordine ? new Date(ordine.data_ordine).toLocaleDateString() : '-'}</td>
                    <td style="padding:12px 10px; font-weight:bold;">€ ${ordine.totale ? parseFloat(ordine.totale).toFixed(2) : '0.00'}</td>
                    <td style="padding:12px 10px;"><span style="background:#fff3cd; color:#856404; padding:4px 8px; border-radius:4px; font-size:0.85em; font-weight:600;">${ordine.stato}</span></td>
                    <td style="padding:12px 10px; font-size:0.85em; max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${ordine.note_condivise || ''}">${ordine.note_condivise || '-'}</td>
                `;
                tableBody.appendChild(tr);
            });
        };
    }

    // Gestione chiusura del modale
    if (closeBtn) closeBtn.onclick = () => modalEvadere.style.display = 'none';
    window.onclick = (e) => { if (e.target === modalEvadere) modalEvadere.style.display = 'none'; };


});
//-------fine gestione funzione ordini da evadere





// ===========================================
// GESTIONE NOTIFICHE PUSH NATIVE
// ===========================================

// 1. Inserisci la tua VAPID PUBLIC KEY (non la private!)
const PUBLIC_VAPID_KEY = 'BMZzRq5pN1IUnhDUztzP3tRZnXiYSI20Q9w9BDAjSA68hGj4i-nkyLuJCUEi7G8mlxGTQ8WX3vUGf71o3SGK-VE'; 

// 2. Funzione per convertire la chiave nel formato richiesto dal browser
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// 3. Funzione principale agganciata al bottone
async function abilitaNotifichePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    alert("Il tuo browser non supporta le notifiche push.");
    return;
  }

  try {
    // Chiediamo il permesso all'utente (fa apparire il popup del browser/telefono)
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      alert("Hai negato i permessi per le notifiche.");
      return;
    }

    // Aspettiamo che il Service Worker sia pronto
    const registration = await navigator.serviceWorker.ready;

    // Generiamo l'iscrizione del dispositivo
    console.log("Creazione certificato push in corso...");
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
    });

    // Recuperiamo l'utente loggato su Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      alert("Devi effettuare l'accesso per attivare le notifiche.");
      return;
    }

    // Salviamo l'iscrizione nella nostra nuova tabella
    const { error: dbError } = await supabase
      .from('push_subscriptions')
      .insert([
        {
          user_id: user.id,
          subscription: subscription // Questo JSON contiene le info di Google/Apple per questo telefono
        }
      ]);

    if (dbError) {
      console.error("Errore nel salvataggio su Supabase:", dbError.message);
      alert("Errore nel salvataggio dell'iscrizione.");
    } else {
      alert("✅ Notifiche attivate con successo su questo dispositivo!");
      // Opzionale: Nascondere il bottone dopo l'attivazione
      document.getElementById('btnNotifiche').style.display = 'none';
    }

  } catch (error) {
    console.error("Errore durante l'attivazione delle notifiche:", error);
    alert("Si è verificato un errore durante l'attivazione delle notifiche.");
  }
}


//--------------------fine notifiche push----------------------------



// Controlla lo stato delle notifiche all'avvio dell'app
async function controllaStatoNotifiche() {
    const btnNotifiche = document.getElementById('btnNotifiche');
    if (!btnNotifiche) return;

    // Se il browser non supporta le notifiche, nascondiamo il bottone a prescindere
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        btnNotifiche.style.display = 'none';
        return;
    }

    // Se l'utente ha esplicitamente bloccato le notifiche, nascondiamo il bottone
    if (Notification.permission === 'denied') {
        btnNotifiche.style.display = 'none';
        return;
    }

    // Se i permessi sono già stati dati, controlliamo se c'è un certificato (subscription) attivo
    if (Notification.permission === 'granted') {
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            
            if (subscription) {
                // Il dispositivo è già iscritto! Nascondiamo il bottone
                btnNotifiche.style.display = 'none';
            }
        } catch (error) {
            console.error("Errore durante il controllo della sottoscrizione:", error);
        }
    }
}




