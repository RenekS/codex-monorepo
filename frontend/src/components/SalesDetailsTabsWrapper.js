// SalesDetailsTabsWrapper.js
import React from 'react';
import { useParams } from 'react-router-dom';
import SalesDetailsTabs from './SalesDetailsTabs';

// Mapa, která přiřadí emailovou adresu konkrétnímu detailu obchodního zástupce
const repMap = {
  '16': {
    id: '16',
    jmeno: 'KOVAŘÍK ALEŠ'
  },
  '17': {
    id: '17',
    jmeno: 'BRTNA JAN'
  },
  '5': {
    id: '5',
    jmeno: 'HINK DAVID'
  },
  '18': {
    id: '18',
    jmeno: 'VALČÍKOVÁ OLGA'
  },
  '19': {
    id: '19',
    jmeno: 'FORMAN BOHUMIL'
  },
  '4': {
    id: '4',
    jmeno: 'JENÍK PAVEL'
  },
  '9': {
    id: '9',
    jmeno: 'KOMENDIR LUMÍR'
  },
  '20': {
    id: '20',
    jmeno: 'CHRÁSTKOVÁ JANA'
  },
  '3': {
    id: '3',
    jmeno: 'SCHNEER RENÉ'
  },
  '10': {
    id: '10',
    jmeno: 'HINK DAVID'
  },
  '18': {
    id: '18',
    jmeno: 'OLGA VALČÍKOVÁ'
  }
};

const SalesDetailsTabsWrapper = () => {
  const { repId } = useParams(); // repId bude obsahovat např. "brno_sklad@czstyle.cz"

  // Pokud v mapě najdeme odpovídající detail, použijeme jej; jinak použijeme hodnotu z URL jako default
  const detail = {
    type: 'rep',
    data: repMap[repId] || { id: repId, jmeno: repId }
  };

  return (
    <SalesDetailsTabs
      detail={detail}
      onBack={() => window.history.back()}
      groupBy="salesrep"
    />
  );
};

export default SalesDetailsTabsWrapper;
