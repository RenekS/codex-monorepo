import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import { saveAs } from 'file-saver';
import '../css/App.css';

function ObjednavkaPTDetail() {
  const { orderId } = useParams();
  const [orderDetails, setOrderDetails] = useState(null);
  const [orderItems, setOrderItems] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/get-pt-order-details/${orderId}`);
        setOrderDetails(response.data.orderDetails);
        setOrderItems(response.data.orderItems);
      } catch (error) {
        console.error('Error loading order details:', error);
      }
    };

    fetchData();
  }, [orderId]);

  const handleDownloadPdf = async () => {
    try {
      const url = `${process.env.REACT_APP_API_URL}/generate-pdf/${orderId}`; // Dynamické přidání orderId do URL
      const response = await axios.get(url, {
        responseType: 'blob', // Důležité pro správné zpracování binárního PDF
      });
  
      const pdfBlob = new Blob([response.data], { type: 'application/pdf' });
      saveAs(pdfBlob, `order-details-${orderId}.pdf`); // Dynamické pojmenování souboru
    } catch (error) {
      console.error('Error downloading PDF:', error);
    }
  };
  const hrStyle = { backgroundColor: '#000', height: '1px' };
  return (
    <div className="container mt-5">
      <div className="card">
        <h2 className="card-header">Detaily Objednávky</h2>
        <div className="card-body">
          <div className="row">
            <div className="col-md-6 mb-4">
              <h5>Informace o dodavateli</h5>
              <p><strong>Název:</strong> CZECH STYLE, spol. s r.o.</p>
              <p><strong>IČ:</strong> 25560174</p>
              <p><strong>DIČ:</strong> CZ25560174</p>
              <p><strong>Adresa:</strong> Tečovská 1239, 76302 Zlín</p>
            </div>
            <div className="col-md-6 mb-4">
              <h5>Informace o odběrateli</h5>
              {orderDetails && (
                <>
                  <p><strong>Název:</strong> {orderDetails.CustomerName}</p>
                  <p><strong>IČ:</strong> {orderDetails.CustomerRegNo}</p>
                  <p><strong>DIČ:</strong> {orderDetails.VatNo}</p>
                  <p><strong>Adresa:</strong> {orderDetails.CustomerStreet}, {orderDetails.CustomerCity}, {orderDetails.CustomerZip}</p>
                </>
              )}
            </div>
          </div>
          <hr style={hrStyle} />

          <div className="row">
          <div className="col-md-4">
            <h5>Informace</h5>
            <p><strong>Platba:</strong> {orderDetails?.PaymentType}</p>
            <p><strong>Stav:</strong> {orderDetails?.Status}</p>
            <p><strong>Datum importu:</strong> {orderDetails?.DateOfImport}</p>
            <p><strong>Spárováno s AX:</strong> Ano/Ne (Placeholder)</p>
          </div>
          <div className="col-md-4">
            <h5>Doprava</h5>
            <p><strong>Doprava:</strong> Placeholder</p>
            <p><strong>Vozidlo:</strong> Placeholder</p>
            <p><strong>Telefon na řidiče:</strong> Placeholder</p>
            <p><strong>Číslo balíku:</strong> Placeholder</p>
          </div>
          <div className="col-md-4"> {/* Upravena třída pro rovnoměrné rozdělení prostoru mezi 3 sloupce */}
            <h5>Náklady</h5>
            <p><strong>Doprava z Prahy:</strong> Placeholder</p>
            <p><strong>Doprava ze Zlína:</strong> Placeholder</p>
            <p><strong>Poplatek B2B:</strong> Placeholder</p>
            <p><strong>Doběrečné:</strong> Placeholder</p>
          </div>
        </div>

          <hr style={hrStyle} />

          <h5>Položky objednávky</h5>
          <table className="table">
            <thead>
              <tr>
                <th>Kód zboží</th>
                <th>EAN</th>
                <th>Název</th>
                <th>Cena/ks</th>
                <th>Celkem</th>
              </tr>
            </thead>
            <tbody>
              {orderItems.map((item) => (
                <tr key={item.ID}>
                  <td>{item.PartNo !== null ? item.PartNo : "Doprava"}</td>
                  <td>{item.EAN}</td>
                  <td>{item.Description}</td>
                  <td>{item.UnitPrice} {orderDetails?.Currency}</td>
                  <td>{item.TotalPrice} {orderDetails?.Currency}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <hr style={hrStyle} />

          <h5>Souhrn</h5>
          <p><strong>Celková cena:</strong> {orderDetails?.TotalPrice} {orderDetails?.Currency}</p>
          <p><strong>Poznámka:</strong> {orderDetails?.Note}</p>
        </div>
        <button className="btn btn-primary no-print" onClick={handleDownloadPdf}>Stáhnout PDF</button>
      </div>
    </div>
  );
};

export default ObjednavkaPTDetail;
