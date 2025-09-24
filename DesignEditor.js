import React, { useRef, useEffect } from 'react';
import { fabric } from 'fabric';

const DesignEditor = ({ onDesignChange }) => {
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);

  useEffect(() => {
    // Inizializza Fabric.js sul canvas HTML
    const fabricCanvas = new fabric.Canvas(canvasRef.current, {
      width: 500,
      height: 500,
    });
    fabricCanvasRef.current = fabricCanvas;

    // Aggiungi un rettangolo come esempio
    const rect = new fabric.Rect({
      left: 100,
      top: 100,
      fill: 'red',
      width: 200,
      height: 50,
    });
    fabricCanvas.add(rect);

    // Gestisci il cambiamento del design
    const handleModified = () => {
      // Esporta il canvas come un'immagine Data URL (base64)
      const dataUrl = fabricCanvas.toDataURL({ format: 'png' });
      onDesignChange(dataUrl);
    };

    fabricCanvas.on('object:modified', handleModified);
    fabricCanvas.on('object:added', handleModified);

    // Pulizia
    return () => {
      fabricCanvas.dispose();
    };
  }, []);

  const addText = () => {
    const text = new fabric.IText('Il Tuo Testo', {
      left: 50,
      top: 50,
      fontSize: 24,
      fill: 'blue',
    });
    fabricCanvasRef.current.add(text);
  };

  const addImage = (e) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const imgObj = new Image();
      imgObj.src = event.target.result;
      imgObj.onload = () => {
        const image = new fabric.Image(imgObj, {
          left: 0,
          top: 0,
          scaleX: 0.5,
          scaleY: 0.5,
        });
        fabricCanvasRef.current.add(image);
      };
    };
    reader.readAsDataURL(e.target.files[0]);
  };

  return (
    <div>
      <canvas ref={canvasRef} style={{ border: '1px solid black' }} />
      <div>
        <button onClick={addText}>Aggiungi Testo</button>
        <input type="file" onChange={addImage} />
      </div>
    </div>
  );
};

export default DesignEditor;
