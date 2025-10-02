import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

function ProductDetail() {
  const { polozka } = useParams();
  const [product, setProduct] = useState(null);
  const [pricePolicies, setPricePolicies] = useState([]);

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL}/productdetail/${polozka}`)
      .then(response => response.json())
      .then(data => {
        setProduct(data.product);
        setPricePolicies(data.pricePolicies);
      })
      .catch(error => console.error('Error fetching product detail:', error));
  }, [polozka]);

  if (!product) {
    return <div>Loading...</div>;
  }

  return (
    <div className="product-detail">
      <h2>Detail produktu</h2>
      <p><strong>Položka:</strong> {product.ItemId}</p>
      <p><strong>Název:</strong> {product.ItemName}</p>
      <p><strong>Výrobce:</strong> {product.ItsProducerCode}</p>
      {/* Zde můžete přidat další atributy produktu podle potřeby */}
      
      <h3>Cenové politiky</h3>
      <table>
        <thead>
          <tr>
            <th>Zdroj</th>
            <th>1_eshop</th>
            <th>2_pult</th>
            <th>3_servis</th>
            <th>4_vo</th>
            <th>5_vip</th>
            <th>6_indiv</th>
            <th>7_dopravci</th>
            <th>Platnost od</th>
            <th>Platnost do</th>
          </tr>
        </thead>
        <tbody>
          {pricePolicies.map((policy, index) => (
            <tr key={index}>
              <td>{policy.zdroj}</td>
              <td>{policy['1_eshop']}</td>
              <td>{policy['2_pult']}</td>
              <td>{policy['3_servis']}</td>
              <td>{policy['4_vo']}</td>
              <td>{policy['5_vip']}</td>
              <td>{policy['6_indiv']}</td>
              <td>{policy['7_dopravci']}</td>
              <td>{policy.platnost_od}</td>
              <td>{policy.platnost_do}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ProductDetail;
