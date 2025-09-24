import React, { useState } from 'react';
import './App.css';
import TshirtScene from './components/TshirtScene';
import DesignEditor from './components/DesignEditor';

function App() {
  const [designData, setDesignData] = useState(null);

  // La funzione che riceverà i dati del design dal componente DesignEditor
  const handleDesignChange = (dataUrl) => {
    setDesignData(dataUrl);
  };

  return (
    <div className="app-container">
      <div className="editor-panel">
        <h2>Editor Grafico</h2>
        <DesignEditor onDesignChange={handleDesignChange} />
      </div>
      <div className="viewer-panel">
        <TshirtScene designData={designData} />
      </div>
      <div className="details-panel">
        <h2>Dettagli Prodotto</h2>
        {/* Qui puoi aggiungere controlli per taglia, colore base, ecc. */}
      </div>
    </div>
  );
}

export default App;
