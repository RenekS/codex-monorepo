import React, { useState, useEffect } from 'react';
import axios from 'axios';
import successSoundFile from './sounds/success-sound.mp3';
import errorSoundFile from './sounds/error-sound.mp3';
import sound1 from './sounds/1.m4a';
import sound2 from './sounds/2.m4a';
import sound3 from './sounds/3.m4a';
import sound4 from './sounds/4.m4a';
import sound5 from './sounds/5.m4a';
import sound6 from './sounds/6.m4a';
import sound7 from './sounds/7.m4a';
import sound8 from './sounds/8.m4a';
import sound9 from './sounds/9.m4a';
import sound10 from './sounds/10.m4a';
import changeSoundFile from './sounds/change.wav';

import './css/OrdersPicking.css';

function NumberPad({ value, onSubmit, onCancel, selectedItem }) {
  const [inputValue, setInputValue] = useState(value.toString());

  const handleButtonClick = (number) => {
    setInputValue(prev => prev === '0' ? number.toString() : prev + number);
  };

  const handleClear = () => {
    setInputValue('0');
  };

  const handleBackspace = () => {
    setInputValue(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
  };

  const handleSubmit = () => {
    const numericValue = parseInt(inputValue, 10);
    if (numericValue >= 0 && numericValue <= (selectedItem ? parseInt(selectedItem.Product_Quantity, 10) : Infinity)) {
      onSubmit(numericValue);
    } else {
      // Zobrazit chybu nebo přehrát chybový zvuk
    }
  };

  return (
    <div className="number-pad">
      <input type="text" value={inputValue} readOnly />
      <div className="number-pad-buttons">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(number => (
          <button key={number} onClick={() => handleButtonClick(number)}>{number}</button>
        ))}
      </div>
      <button onClick={handleClear}>C</button>
      <button onClick={handleBackspace}>←</button>
      <button className="number-pad-submit" onClick={handleSubmit}>Potvrdit</button>
      <button className="number-pad-cancel" onClick={onCancel}>Zrušit</button>
    </div>
  );
}


function OrderDetail() {
  const [orderItems, setOrderItems] = useState([]);
  const [packageCounts, setPackageCounts] = useState({});
  const [editingPackage, setEditingPackage] = useState(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [modalBarcodeInput, setModalBarcodeInput] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showOrderSelectModal, setShowOrderSelectModal] = useState(false);
  const [filteredOrders, setFilteredOrders] = useState([]);

 useEffect(() => {
  const fetchOrderItems = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/process_picking_orders');
      setOrderItems(response.data);

      // Inicializace packageCounts s Product_Picked
      const initialPackageCounts = {};
      response.data.forEach(item => {
        const orderProductKey = `${item.Order_Number}_${item.Product_Reference}`;
        initialPackageCounts[orderProductKey] = item.Product_Picked || 0;
      });
      setPackageCounts(initialPackageCounts);
    } catch (error) {
      console.error('Error fetching order details:', error);
    }
  };
  fetchOrderItems();
}, []);


  const playSound = (isSuccess) => {
    const soundFile = isSuccess ? successSoundFile : errorSoundFile;
    new Audio(soundFile).play();
  };

 useEffect(() => {
  if (selectedItem) {
    const orderProductKey = `${selectedItem.Order_Number}_${selectedItem.Product_Reference}`;
    const pickedQuantity = packageCounts[orderProductKey];
    // Aktualizujte pouze pokud je nové množství napickovaných produktů různé
    if (pickedQuantity !== undefined && selectedItem.Picked_Quantity !== pickedQuantity) {
      setSelectedItem(prev => ({
        ...prev,
        Picked_Quantity: pickedQuantity
      }));
    }
  }
}, [packageCounts, selectedItem]);



  const handleDoubleClick = (productReference, maxQuantity) => {
    const currentCount = packageCounts[productReference] || 0;
    const newCount = currentCount === maxQuantity ? 0 : maxQuantity;
    updatePackageCount(productReference, newCount, maxQuantity);
  };

 const handlePadSubmit = (newCount) => {
  if (editingPackage && selectedItem) {
    const orderProductKey = `${selectedItem.Order_Number}_${editingPackage}`;
    if (newCount >= 0 && newCount <= parseInt(selectedItem.Product_Quantity, 10)) {
      updatePackageCount(orderProductKey, newCount, parseInt(selectedItem.Product_Quantity, 10));
      sendPickedUpdateToServer(selectedItem.Order_Number, editingPackage, newCount);
      setEditingPackage(null);
    } else {
      playSound(false);
    }
  }
};

  const handlePadCancel = () => {
    setEditingPackage(null);
  };

const handleButtonClick = (orderNumber, productReference, change, maxQuantity) => {
  console.log(`handleButtonClick - Order: ${orderNumber}, Reference: ${productReference}, Change: ${change}, Max: ${maxQuantity}`);

  const orderProductKey = `${orderNumber}_${productReference}`;
  const currentCount = packageCounts[orderProductKey] || 0;
  const newCount = parseInt(currentCount, 10) + change; // Převod na číslo

  console.log(`New count for ${orderProductKey}: ${newCount}`);

  if (newCount >= 0 && newCount <= maxQuantity) {
    updatePackageCount(orderProductKey, newCount, maxQuantity);
    sendPickedUpdateToServer(orderNumber, productReference, newCount);
  } else {
    playSound(false); // Přehrát chybový zvuk, pokud je nový počet mimo povolený rozsah
  }

  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
};



const handleModalBarcodeScan = async (ean) => {
  console.log(`Skenování EAN: ${ean}`);
  const matchedItem = orderItems.find(item => item.Product_Ean === ean);

  if (matchedItem) {
    console.log(`Produkt nalezen: ${matchedItem.Product_Name}, Police: ${matchedItem.Picking_Position}`);
    const orderProductKey = `${matchedItem.Order_Number}_${matchedItem.Product_Reference}`;
    const currentCount = parseInt(packageCounts[orderProductKey] || 0, 10);
    const newCount = currentCount + 1;

    if (!selectedItem || selectedItem.Product_Ean !== ean) {
      setSelectedItem(matchedItem);
      setShowModal(true);
      console.log(`Otevírání modálního okna pro produkt: ${matchedItem.Product_Name}`);

      // Převod čísla police na číslo
      const pickingPositionNumber = parseInt(matchedItem.Picking_Position, 10);
      if (!isNaN(pickingPositionNumber)) {
        try {
          console.log(`Pokus o přehrání zvuku police: ${pickingPositionNumber}`);
          await playNumberAudio(pickingPositionNumber);
          console.log(`Zvuk police ${pickingPositionNumber} byl přehrán`);
        } catch (error) {
          console.error(`Chyba při přehrávání zvuku police: ${error}`);
        }
      } else {
        console.error(`Hodnota police ${matchedItem.Picking_Position} není platné číslo.`);
      }
    }

    if (newCount <= parseInt(matchedItem.Product_Quantity, 10)) {
      updatePackageCount(orderProductKey, newCount, parseInt(matchedItem.Product_Quantity, 10));
      sendPickedUpdateToServer(matchedItem.Order_Number, matchedItem.Product_Reference, newCount);
      playSound(true);
    } else {
      playSound(false);
    }
  } else {
    console.log(`Produkt s EAN ${ean} nebyl nalezen.`);
    playSound(false);
  }
};


const playNumberAudio = async (input) => {
  // Převedení vstupu na číslo (pokud je to možné)
  const number = parseInt(input, 10);

  // Kontrola, zda je vstup platné číslo
  if (isNaN(number)) {
    console.error(`Vstupní hodnota ${input} není platné číslo.`);
    return;
  }

  // Log pro kontrolu, který soubor se pokoušíme otevřít
  console.log(`Funkce playNumberAudio volána s číslem: ${number}`);

  let audioFile;
  switch(number) {
    case 1: audioFile = sound1; break;
    case 2: audioFile = sound2; break;
    case 3: audioFile = sound3; break;
    case 4: audioFile = sound4; break;
    case 5: audioFile = sound5; break;
    case 6: audioFile = sound6; break;
    case 7: audioFile = sound7; break;
    case 8: audioFile = sound8; break;
    case 9: audioFile = sound9; break;
    case 10: audioFile = sound10; break;
    default: audioFile = null;
  }

  if (audioFile) {
    const audio = new Audio(audioFile);
    console.log(`Pokus o přehrání zvukového souboru: ${audioFile}`);
    try {
      await audio.play();
    } catch (error) {
      console.error(`Chyba při přehrávání zvuku: ${error}`);
    }
  } else {
    console.log(`Zvukový soubor pro číslo ${number} není dostupný.`);
  }
};












const handleSingleOrderScan = async (ean) => {
  const matchedItem = orderItems.find(item => item.Product_Ean === ean);
  if (matchedItem) {
    const orderProductKey = `${matchedItem.Order_Number}_${matchedItem.Product_Reference}`;
    const currentCount = parseInt(packageCounts[orderProductKey] || 0, 10);
    const newCount = currentCount + 1;

    console.log(`Skenování jednoho produktu: ${matchedItem.Product_Name} (${matchedItem.Product_Ean}), Nový počet: ${newCount}`);

    if (newCount > parseInt(matchedItem.Product_Quantity, 10)) {
      console.log('Překročeno maximální množství - chybový zvuk');
      new Audio(errorSoundFile).play();
    } else {
      updatePackageCount(orderProductKey, newCount, parseInt(matchedItem.Product_Quantity, 10));
      setSelectedItem(matchedItem);
      setShowModal(true);

      // Přehrání zvuku čísla police
      try {
        console.log(`Pokus o přehrání zvuku police: ${matchedItem.Picking_Position}`);
        await playNumberAudio(matchedItem.Picking_Position);
        console.log(`Zvuk police ${matchedItem.Picking_Position} byl přehrán`);
      } catch (error) {
        console.error(`Chyba při přehrávání zvuku police: ${error}`);
      }

      setTimeout(() => {
        setShowModal(false);
      }, 10000);
    }
  }
};



const handleMultipleOrdersScan = (selectedOrder) => {
  const orderProductKey = `${selectedOrder.Order_Number}_${selectedOrder.Product_Reference}`;
  const currentCount = parseInt(packageCounts[orderProductKey] || 0, 10);
  const newCount = currentCount + 1;

  if (newCount > parseInt(selectedOrder.Product_Quantity, 10)) {
    new Audio(errorSoundFile).play();
  } else {
    updatePackageCount(orderProductKey, newCount, parseInt(selectedOrder.Product_Quantity, 10));
  }
};


const handleMultipleOrderScan = (ean) => {
  const matchedItem = filteredOrders.find(item => item.Product_Ean === ean);
  if (matchedItem) {
    const orderProductKey = `${matchedItem.Order_Number}_${matchedItem.Product_Reference}`;
    const currentCount = parseInt(packageCounts[orderProductKey] || 0, 10);
    const newCount = currentCount + 1;

    if (newCount <= parseInt(matchedItem.Product_Quantity, 10)) {
      updatePackageCount(orderProductKey, newCount, parseInt(matchedItem.Product_Quantity, 10));
      sendPickedUpdateToServer(matchedItem.Order_Number, matchedItem.Product_Reference, newCount);

      // Přehrání zvuku 'change'
      new Audio(changeSoundFile).play();
    } else {
      playSound(false);
    }
  }
};



const handleQuantityChange = async (item, change) => {
  const orderProductKey = `${item.Order_Number}_${item.Product_Reference}`;
  const currentCount = packageCounts[orderProductKey] || 0;
  const newCount = Math.max(0, currentCount + change);

  // Aktualizovat množství v packageCounts
  setPackageCounts(prevCounts => ({ ...prevCounts, [orderProductKey]: newCount }));

  try {
    const response = await axios.post('http://localhost:3001/api/updatePickedQuantity', {
      orderNumber: item.Order_Number,
      productReference: item.Product_Reference,
      pickedQuantity: newCount
    });

    if(response.status === 200) {
      playSound(true); // Přehrát kladný zvuk
    } else {
      playSound(false); // Přehrát záporný zvuk v případě chyby
    }
  } catch (error) {
    playSound(false); // Přehrát záporný zvuk v případě chyby
  }
};





const sendPickedUpdateToServer = async (orderNumber, productReference, pickedQuantity) => {
  try {
    await axios.post('http://localhost:3001/api/updatePickedQuantity', {
      orderNumber,
      productReference,
      pickedQuantity
    });
  } catch (error) {
    console.error('Error sending picked quantity update to server:', error);
  }
};

const updatePackageCount = (orderProductKey, newCount, maxQuantity) => {
  setPackageCounts(prevCounts => ({ ...prevCounts, [orderProductKey]: newCount }));
  if (newCount <= maxQuantity) {
    playSound(true);
  }
};

useEffect(() => {
  const handleBarcodeScan = (event) => {
    if (event.key === 'Enter') {
      if (showModal && selectedItem) {
        handleModalBarcodeScan(modalBarcodeInput);
      } else if (showOrderSelectModal) {
        handleMultipleOrderScan(modalBarcodeInput);
      } else {
        const matchedItems = orderItems.filter(item => item.Product_Ean === barcodeInput);
        if (matchedItems.length > 1) {
          setFilteredOrders(matchedItems);
          setShowOrderSelectModal(true);
        } else if (matchedItems.length === 1) {
          handleSingleOrderScan(barcodeInput);
        } else {
          // Přehrání chybového zvuku, pokud nebyl nalezen žádný produkt
          console.log('Naskenován neplatný kód, přehrává se chybový zvuk');
          new Audio(errorSoundFile).play();
        }
      }
      setModalBarcodeInput('');
      setBarcodeInput('');
    } else {
      if (showModal || showOrderSelectModal) {
        setModalBarcodeInput(prev => prev + event.key);
      } else {
        setBarcodeInput(prev => prev + event.key);
      }
    }
  };

  window.addEventListener('keypress', handleBarcodeScan);

  return () => {
    window.removeEventListener('keypress', handleBarcodeScan);
  };
}, [barcodeInput, showModal, modalBarcodeInput, selectedItem, showOrderSelectModal, orderItems]);




const selectOrderForPicking = (selectedOrder) => {
  setSelectedItem(selectedOrder);
  setShowModal(true);
  setShowOrderSelectModal(false);

  // Zpracování skenování čárových kódů pro vybraný produkt
  handleMultipleOrdersScan(selectedOrder);
};

  const closeModal = () => {
    setShowModal(false);
    setShowOrderSelectModal(false);
    setModalBarcodeInput('');
  };

  if (orderItems.length === 0) {
    return <div>Loading...</div>;
  }

  return (
    <div className="order-detail-container">
      <h1>Detaily Objednávky</h1>
         <table>
        <thead>
          <tr>
            <th>Kód a EAN</th>
            <th>Název produktu</th>
            <th>Množství</th>
            <th>Police</th>
            <th>Pickováno</th>
          </tr>
        </thead>
        <tbody>
          {orderItems.map((item) => (
            <tr key={item.Order_Number}>
               <td className="small-font">
                  <div>Kód: {item.Order_Number}</div>
                  <div>EAN: {item.Product_Ean}</div>
              </td>
              <td>{item.Product_Name}</td>
              <td>{item.Product_Quantity}</td>
              <td>{item.Picking_Position}</td>
              <td>
                <button onClick={() => handleButtonClick(item.Order_Number, item.Product_Reference, 1, parseInt(item.Product_Quantity))}>+</button>
                <span>{packageCounts[`${item.Order_Number}_${item.Product_Reference}`] || 0}</span>
                <button onClick={() => handleButtonClick(item.Order_Number, item.Product_Reference, -1, parseInt(item.Product_Quantity))}>-</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editingPackage && (
        <NumberPad
          value={packageCounts[editingPackage] || 0}
          onSubmit={handlePadSubmit}
          onCancel={handlePadCancel}
          selectedItem={selectedItem}
        />
      )}

{showModal && selectedItem && (
  <div className="modal fade show" style={{ display: "block" }} tabIndex="-1">
    <div className="modal-dialog modal-dialog-centered">
      <div className="modal-content">
        <div className="modal-body">
          <div className="modal-split-container">
            <div className="picking-position-number">{selectedItem.Picking_Position}</div>
            <div className="picking-details">
              <div className="quantity-info">{selectedItem.Picked_Quantity || 0}/{selectedItem.Product_Quantity}</div>
              <div className="quantity-controls">
                <button 
                  className="quantity-control-button" 
                  onClick={() => handleQuantityChange(selectedItem, 1)}>
                  +
                </button>
                <div className="quantity-display">#</div>
                <button 
                  className="quantity-control-button" 
                  onClick={() => handleQuantityChange(selectedItem, -1)}>
                  -
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={closeModal}>Zavřít</button>
        </div>
      </div>
    </div>
  </div>
)}






{showOrderSelectModal && (
  <div className="modal fade show" style={{ display: "block" }} tabIndex="-1">
    <div className="modal-dialog modal-dialog-centered">
      <div className="modal-content">
        <div className="modal-header">
          <h5 className="modal-title">Vyberte Objednávku pro Pickování</h5>
          <button type="button" className="btn-close" onClick={closeModal}></button>
        </div>
        <div className="modal-body">
          {filteredOrders.map(order => (
            <div key={order.Order_Number} className="modal-item" onClick={() => selectOrderForPicking(order)}>
              Objednávka č. {order.Order_Number} - {order.Product_Name} {order.Picking_Position}
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={closeModal}>Zavřít</button>
        </div>
      </div>
    </div>
    <div className="modal-backdrop fade show"></div>
  </div>
)}

</div>

)}; 

export default OrderDetail; 