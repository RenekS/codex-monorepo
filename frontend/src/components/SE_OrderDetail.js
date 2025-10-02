import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import '../css/OrderDetail.css'; 
import successSoundFile from '../sounds/success-sound.mp3';
import errorSoundFile from '../sounds/error-sound.mp3';

function NumberPad({ value, onSubmit, onCancel }) {
  const [inputValue, setInputValue] = useState(value.toString());

  const handleButtonClick = (number) => {
    setInputValue((prev) => (prev === '0' ? number.toString() : prev + number));
  };

  const handleClear = () => {
    setInputValue('0');
  };

  const handleBackspace = () => {
    setInputValue((prev) => (prev.length > 1 ? prev.slice(0, -1) : '0'));
  };

  const handleSubmit = () => {
    onSubmit(parseInt(inputValue, 10));
  };

  return (
    <div className="number-pad">
      <input type="text" value={inputValue} readOnly />
      <div className="number-pad-buttons">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((number) => (
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
  const { orderNumber } = useParams();
  console.log("Získané orderNumber z URL:", orderNumber);
  const navigate = useNavigate();
  const [orderDetail, setOrderDetail] = useState(null);
  const [editingPackage, setEditingPackage] = useState(null);
  const [packageCounts, setPackageCounts] = useState({});
  const [packageTypes, setPackageTypes] = useState(['Krabice 1']);
  const [totalPackages, setTotalPackages] = useState(1);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [pickedOrders, setPickedOrders] = useState([]);
  const [currentOrderIndex, setCurrentOrderIndex] = useState(-1);
// Funkce pro kontrolu, zda je objednávka plně naplněna
  const isOrderFullyPacked = () => {
    return orderDetail.Items.every(item => packageCounts[item.articleCode] === item.quantity);
  };

  // Renderovací funkce pro tlačítko
  const renderPackingButton = () => {
    const isFullyPacked = isOrderFullyPacked();
    const buttonText = isFullyPacked ? 'Zabalit' : 'Částečně zabalit';
    return (
      <button onClick={handlePacking}>{buttonText}</button>
    );
  };

  // Handler pro kliknutí na tlačítko
  const handlePacking = () => {
    // Zde bude logika pro zpracování balení
    if (isOrderFullyPacked()) {
      console.log('Objednávka je plně naplněna a bude zabalena.');
    } else {
      console.log('Objednávka je částečně naplněna a bude částečně zabalena.');
    }
  };

useEffect(() => {
  const fetchPickedOrders = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/orders/picked`);
      console.log("Načtené pickované objednávky:", response.data);
      setPickedOrders(response.data);
      const index = response.data.findIndex(o => String(o.Order_Number) === String(orderNumber));
      console.log("Index aktuální objednávky:", index);
      setCurrentOrderIndex(index);
    } catch (error) {
      console.error('Error fetching picked orders:', error);
    }
  };
  fetchPickedOrders();
}, [orderNumber]);

const isCurrentOrderInPickedOrders = pickedOrders.some(o => String(o.Order_Number) === String(orderNumber));

  const goToPreviousOrder = () => {
  if (currentOrderIndex > 0 && pickedOrders[currentOrderIndex - 1]) {
    navigate(`/eforder/${pickedOrders[currentOrderIndex - 1].Order_Number}`);
  } else {
    new Audio(errorSoundFile).play();
  }
};

const goToNextOrder = () => {
  if (currentOrderIndex < pickedOrders.length - 1 && pickedOrders[currentOrderIndex + 1]) {
    navigate(`/eforder/${pickedOrders[currentOrderIndex + 1].Order_Number}`);
  } else {
    new Audio(errorSoundFile).play();
  }
};


  useEffect(() => {
    const fetchOrderDetail = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/eforder/${orderNumber}`);
        setOrderDetail(response.data);
      } catch (error) {
        console.error('Error fetching order details:', error);
      }
    };
    fetchOrderDetail();
  }, [orderNumber]);

  useEffect(() => {
    const handleBarcodeScan = (event) => {
      if (event.key !== 'Enter') {
        setBarcodeInput(prev => prev + event.key);
      } else {
        console.log('Skenovaný kód:', barcodeInput);

        const foundItem = orderDetail && orderDetail.Items.find(item => item.productBarCode === barcodeInput);
        if (foundItem) {
          updatePackageCount(foundItem.articleCode, (packageCounts[foundItem.articleCode] || 0) + 1, foundItem.quantity);
          new Audio(successSoundFile).play();
        }

        setBarcodeInput('');
      }
    };

    window.addEventListener('keypress', handleBarcodeScan);

    return () => {
      window.removeEventListener('keypress', handleBarcodeScan);
    };
  }, [barcodeInput, orderDetail, packageCounts]);

  const updatePackageCount = (productCode, newCount, maxQuantity) => {
    setPackageCounts((prev) => ({ ...prev, [productCode]: newCount }));
    if (newCount > maxQuantity) {
      new Audio(errorSoundFile).play();
    } else {
      new Audio(successSoundFile).play();
    }
  };

  const handleOpenPad = (productCode) => {
    setEditingPackage(productCode);
  };

  const handlePadSubmit = (newCount) => {
    setPackageCounts((prev) => ({ ...prev, [editingPackage]: newCount }));
    setEditingPackage(null);
  };

  const handlePadCancel = () => {
    setEditingPackage(null);
  };


  const handleDoubleClick = (productCode, quantity) => {
    const currentCount = packageCounts[productCode] || 0;
    updatePackageCount(productCode, currentCount === quantity ? 0 : quantity, quantity);
  };

  const handlePackageCountChange = (change) => {
    const newCount = Math.max(totalPackages + change, 1);
    setTotalPackages(newCount);
    if (newCount > packageTypes.length) {
      setPackageTypes([...packageTypes, 'Krabice 1']);
    } else if (newCount < packageTypes.length) {
      setPackageTypes(packageTypes.slice(0, newCount));
    }
  };

  const handlePackageTypeChange = (index, newType) => {
    const newPackageTypes = [...packageTypes];
    newPackageTypes[index] = newType;
    setPackageTypes(newPackageTypes);
  };

  if (!orderDetail) {
    return <div>Loading...</div>;
  }

  return (
    <div className="order-detail-container">
<button onClick={goToPreviousOrder} disabled={!isCurrentOrderInPickedOrders || currentOrderIndex <= 0}>Předchozí Objednávka</button>
      <button onClick={goToNextOrder} disabled={!isCurrentOrderInPickedOrders || currentOrderIndex >= pickedOrders.length - 1}>Další Objednávka</button>
 {renderPackingButton()}
      <h1>Objednávka č. {orderDetail.number}</h1>
      <h2>{orderDetail.buyerName}</h2>
      <h3>{orderDetail.deliveryMethod} - {orderDetail.methodOfPayment}</h3>
      <table>
        <thead>
          <tr>
            <th>Kód produktu</th>
            <th>EAN</th>
            <th>Název produktu</th>
            <th>Množství</th>
            <th>Balík</th>
          </tr>
        </thead>
        <tbody>
          {orderDetail.Items.map((item) => (
            <tr key={item.articleCode} onDoubleClick={() => handleDoubleClick(item.articleCode, item.quantity)}>
              <td>{item.productCode}</td>
              <td>{item.productBarCode}</td>
              <td>{item.description}</td>
              <td>{item.quantity}</td>
              <td>
                <button onClick={() => updatePackageCount(item.articleCode, (packageCounts[item.articleCode] || 0) + 1, item.quantity)}>+</button>
                <span className={packageCounts[item.articleCode] > item.quantity ? 'excess' : packageCounts[item.articleCode] === item.quantity ? 'exact' : ''}>
                  {packageCounts[item.articleCode] || 0}
                </span>
                <button onClick={() => updatePackageCount(item.articleCode, Math.max((packageCounts[item.articleCode] || 0) - 1, 0), item.quantity)}>-</button>
                <button onClick={() => handleOpenPad(item.articleCode)}>#</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editingPackage && (
        <NumberPad value={packageCounts[editingPackage] || 0} onSubmit={handlePadSubmit} onCancel={handlePadCancel} />
      )}

      {/* Správa balení */}
      <div className="package-management">
        <h2>Počet balení: {totalPackages}</h2>
        <button onClick={() => handlePackageCountChange(1)}>+</button>
        <button onClick={() => handlePackageCountChange(-1)}>-</button>
        {Array.from({ length: totalPackages }).map((_, index) => (
          <div key={index} className="package-selection">
            <label>Balení {index + 1}:</label>
            <select value={packageTypes[index]} onChange={(e) => handlePackageTypeChange(index, e.target.value)}>
              <option value="Krabice 1">Krabice 1</option>
              <option value="Krabice 2">Krabice 2</option>
              <option value="Krabice 3">Krabice 3</option>
              <option value="Paleta">Paleta</option>
              <option value="Volně">Volně</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

export default OrderDetail;