// TyreMeasurement.js
import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Modal,
  Backdrop,
  Fade
} from '@mui/material';
import axios from 'axios';

const TyreMeasurement = ({ vehicleId, RZ, closeMeasurement }) => {
  const [tyreData, setTyreData] = useState([]);
  const [analysisData, setAnalysisData] = useState({ current: [], demounted: [] });
  const [openAnalysis, setOpenAnalysis] = useState(false);

  useEffect(() => {
    // Získání dat o pneumatikách pro dané vozidlo (poslední měření)
    const fetchTyreData = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/tyre_info/${RZ}`);
        setTyreData(response.data);
      } catch (error) {
        console.error('Chyba při získávání dat o pneumatikách:', error);
      }
    };

    fetchTyreData();
  }, [RZ]);

  const handleOpenAnalysis = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/tyre_info/all/${RZ}`);
      const measurements = response.data;

      // Získání seznamu všech pneumatik namontovaných na vozidle
      const tyreListResponse = await axios.get(`${process.env.REACT_APP_API_URL}/tyre_list_by_rz/${RZ}`);
      const allTyres = tyreListResponse.data;

      // Vytvoření mapy pneumatik podle TyreNo, pozice a data montáže
      const tyreInstancesMap = {};

      // Oddělení aktuálních a vyměněných pneumatik
      const currentTyres = {};
      const demountedTyres = {};

      // Zpracování všech pneumatik z tyre_list
      allTyres.forEach((tyre) => {
        const tyreNo = tyre.TyreNo;
        const position = tyre.Position;
        const mountedDateTime = tyre.Mounted ? new Date(tyre.Mounted) : new Date('1970-01-01');
        const demountedDateTime = tyre.Demounted ? new Date(tyre.Demounted) : new Date('9999-12-31');

        const instanceKey = `${tyreNo}-${position}-${mountedDateTime.getTime()}`;

        const isDemounted = demountedDateTime.getTime() !== new Date('9999-12-31').getTime();
        const tyreInstances = isDemounted ? demountedTyres : currentTyres;

        if (!tyreInstances[instanceKey]) {
          tyreInstances[instanceKey] = {
            TyreNo: tyreNo,
            position: position,
            tyreName: tyre.TyreName || 'Unknown',
            idealPressure: tyre.idealPressure || 0,
            tyreMin: parseFloat(tyre.TyreMin || 1.6),
            tyreMax: parseFloat(tyre.TyreMax || 0),
            mountedAtOdo: tyre.MountedAtOdom !== null ? parseFloat(tyre.MountedAtOdom) : null,
            demountedAtOdo: tyre.DemountedAtOdom !== null ? parseFloat(tyre.DemountedAtOdom) : null,
            demountedAtDeep: tyre.DemountedAtDeep !== '' ? parseFloat(tyre.DemountedAtDeep) : null,
            grooves: {
              outer: [],
              inner: []
            },
            rotated: tyre.Rotated || false,
            tyrePrice: parseFloat(tyre.TyrePrice || 0),
            initialDepthOuter: null,
            initialDepthInner: null,
            mountedDateTime: mountedDateTime,
            demountedDateTime: demountedDateTime
          };

          tyreInstancesMap[instanceKey] = tyreInstances[instanceKey];
        }
      });

      // Zpracování měření a přiřazení k pneumatikám
      measurements.forEach((measurement) => {
        measurement.tyres.forEach((tyre) => {
          const tyreNo = tyre.tyre_list?.TyreNo;
          const position = tyre.tyre_position;

          if (!tyreNo || !position) {
            console.warn(`Chybí TyreNo nebo pozice pro pneumatiku: ${JSON.stringify(tyre)}`);
            return;
          }

          // Převod dat na objekty Date pro porovnání
          const measurementDateTime = new Date(measurement.measurement_date);
          const mountedDateTime = tyre.tyre_list?.Mounted
            ? new Date(tyre.tyre_list.Mounted)
            : new Date('1970-01-01');
          const instanceKey = `${tyreNo}-${position}-${mountedDateTime.getTime()}`;

          const tyreInstance = tyreInstancesMap[instanceKey];
          if (!tyreInstance) {
            // Pokud pneumatika nebyla nalezena v mapě, přeskočíme ji
            return;
          }

          // Kontrola, zda datum měření spadá mezi montáž a demontáž pneumatiky
          if (
            measurementDateTime < tyreInstance.mountedDateTime ||
            measurementDateTime >= tyreInstance.demountedDateTime
          ) {
            return;
          }

          ['outer', 'inner'].forEach((groove) => {
            const depth = tyre[`${groove}_tread_depth`];
            if (depth !== undefined && depth !== null) {
              const depthValue = parseFloat(depth);
              tyreInstance.grooves[groove].push({
                measurement_id: measurement.measurement_id,
                date: measurement.measurement_date,
                odometer: measurement.odometer_reading,
                depth: depthValue,
                measured_pressure: tyre.measured_pressure
              });

              // Nastavení počáteční hloubky
              if (
                tyreInstance[`initialDepth${groove.charAt(0).toUpperCase() + groove.slice(1)}`] === null
              ) {
                tyreInstance[`initialDepth${groove.charAt(0).toUpperCase() + groove.slice(1)}`] = depthValue;
              }
            }
          });

          // Pokud počáteční hloubky nejsou nastaveny a máme TyreMax, nastavíme je
          if (tyreInstance.initialDepthOuter === null) {
            tyreInstance.initialDepthOuter = tyreInstance.tyreMax;
          }
          if (tyreInstance.initialDepthInner === null) {
            tyreInstance.initialDepthInner = tyreInstance.tyreMax;
          }
        });
      });

      // Výpočet analýzy pro aktuální a vyměněné pneumatiky
      const analysisCurrent = performAnalysis(currentTyres, false);
      const analysisDemounted = performAnalysis(demountedTyres, true);

      setAnalysisData({ current: analysisCurrent, demounted: analysisDemounted });
      setOpenAnalysis(true);
    } catch (error) {
      console.error('Chyba při získávání analýzy pneumatik:', error);
    }
  };

  // Funkce pro výpočet wear_rate
  const calculateWearRate = (measurements) => {
    let totalWear = 0;
    let totalDistance = 0;
    for (let i = 1; i < measurements.length; i++) {
      const prev = measurements[i - 1];
      const current = measurements[i];
      const wear = prev.depth - current.depth;
      const distance = current.odometer - prev.odometer;
      if (distance > 0 && wear > 0) {
        totalWear += wear;
        totalDistance += distance;
      }
    }
    return totalDistance > 0 ? totalWear / totalDistance : 0;
  };

  // Funkce pro provedení analýzy
  const performAnalysis = (tyreInstances, isDemounted) => {
    const analysis = [];

    Object.values(tyreInstances).forEach((tyre) => {
      const { outer, inner } = tyre.grooves;

      let wearRateOuter, wearRateInner;
      let currentDepthOuter, currentDepthInner;
      let initialDepthOuter, initialDepthInner;

      // Filtrujeme měření, která jsou po montáži pneumatiky
      const mountedAtOdo = tyre.mountedAtOdo !== null ? tyre.mountedAtOdo : 0;

      const filteredOuter = outer.filter((measurement) => measurement.odometer >= mountedAtOdo);
      const filteredInner = inner.filter((measurement) => measurement.odometer >= mountedAtOdo);

      let currentOdometer = 0;

      if (!isDemounted) {
        // Výpočty pro aktuální pneumatiky
        if (filteredOuter.length >= 2 && filteredInner.length >= 2) {
          // Seřadíme měření podle odometru
          filteredOuter.sort((a, b) => a.odometer - b.odometer);
          filteredInner.sort((a, b) => a.odometer - b.odometer);

          // Výpočet wear_rate pro obě drážky
          wearRateOuter = calculateWearRate(filteredOuter);
          wearRateInner = calculateWearRate(filteredInner);

          // Aktuální hloubky drážek
          currentDepthOuter = filteredOuter[filteredOuter.length - 1].depth;
          currentDepthInner = filteredInner[filteredInner.length - 1].depth;

          // Počáteční hloubky
          initialDepthOuter = filteredOuter[0].depth;
          initialDepthInner = filteredInner[0].depth;

          currentOdometer = filteredOuter[filteredOuter.length - 1].odometer;
        } else if (
          filteredOuter.length === 1 &&
          filteredInner.length === 1 &&
          tyre.mountedAtOdo !== null &&
          tyre.tyreMax !== null
        ) {
          // Výpočet wear_rate pomocí počáteční hloubky a jednoho měření
          const currentMeasurementOuter = filteredOuter[0];
          const currentMeasurementInner = filteredInner[0];
          const distance = currentMeasurementOuter.odometer - tyre.mountedAtOdo;

          if (distance <= 0) {
            console.warn(`Nesprávný stav tachometru pro pneumatiku ${tyre.TyreNo} na pozici ${tyre.position}`);
            return;
          }

          initialDepthOuter = tyre.tyreMax;
          initialDepthInner = tyre.tyreMax;
          currentDepthOuter = currentMeasurementOuter.depth;
          currentDepthInner = currentMeasurementInner.depth;

          wearRateOuter = (initialDepthOuter - currentDepthOuter) / distance;
          wearRateInner = (initialDepthInner - currentDepthInner) / distance;

          currentOdometer = currentMeasurementOuter.odometer;

          // Ověření, že wear_rate není záporná
          if (wearRateOuter < 0 || wearRateInner < 0) {
            console.warn(`Záporná wear_rate pro pneumatiku ${tyre.TyreNo} na pozici ${tyre.position}`);
            return;
          }
        } else {
          // Nedostatek dat pro analýzu
          return;
        }
      } else {
        // Výpočty pro demontované pneumatiky
        if (
          tyre.demountedAtDeep !== null &&
          tyre.mountedAtOdo !== null &&
          tyre.demountedAtOdo !== null &&
          tyre.tyreMax !== null
        ) {
          const distance = tyre.demountedAtOdo - tyre.mountedAtOdo;
          if (distance <= 0) {
            console.warn(`Nesprávný stav tachometru pro pneumatiku ${tyre.TyreNo} na pozici ${tyre.position}`);
            return;
          }

          initialDepthOuter = tyre.tyreMax;
          initialDepthInner = tyre.tyreMax;
          currentDepthOuter = tyre.demountedAtDeep;
          currentDepthInner = tyre.demountedAtDeep;

          wearRateOuter = (initialDepthOuter - currentDepthOuter) / distance;
          wearRateInner = wearRateOuter; // Předpokládáme stejnou wear_rate pro obě drážky

          currentOdometer = tyre.demountedAtOdo;

          // Ověření, že wear_rate není záporná
          if (wearRateOuter < 0) {
            console.warn(`Záporná wear_rate pro pneumatiku ${tyre.TyreNo} na pozici ${tyre.position}`);
            return;
          }
        } else {
          // Nedostatek dat pro analýzu
          return;
        }
      }

      // Výpočet D (doporučená vzdálenost do rotace)
      const TyreMin = tyre.tyreMin;

      let D = null;
      if (wearRateOuter > 0 && wearRateInner > 0 && wearRateInner !== wearRateOuter && !isDemounted) {
        const numerator =
          wearRateInner * currentDepthInner -
          wearRateOuter * currentDepthOuter +
          (wearRateOuter - wearRateInner) * TyreMin;
        const denominator = wearRateInner ** 2 - wearRateOuter ** 2;

        D = numerator / denominator;

        // Validace D
        if (isNaN(D) || D <= 0) {
          D = null;
        } else {
          // Ověření, že D nezpůsobí překročení zbývající životnosti
          const remainingLifeOuter = (currentDepthOuter - TyreMin) / wearRateOuter;
          const remainingLifeInner = (currentDepthInner - TyreMin) / wearRateInner;
          const minRemainingLife = Math.min(remainingLifeOuter, remainingLifeInner);

          if (D > minRemainingLife) {
            D = null;
          } else {
            D = parseFloat(D.toFixed(2));
          }
        }
      }

      // Celkový teoretický nájezd bez rotace
      let theoreticalTotalMileageNoRotation = 'N/A';
      if (wearRateOuter > 0 && wearRateInner > 0) {
        const totalLifeOuter = (initialDepthOuter - TyreMin) / wearRateOuter;
        const totalLifeInner = (initialDepthInner - TyreMin) / wearRateInner;
        theoreticalTotalMileageNoRotation = Math.min(totalLifeOuter, totalLifeInner).toFixed(2);
      } else if (wearRateOuter > 0) {
        theoreticalTotalMileageNoRotation = ((initialDepthOuter - TyreMin) / wearRateOuter).toFixed(2);
      }

      // Celkový teoretický nájezd s rotací
      let theoreticalTotalMileageWithRotation = 'N/A';
      if (D !== null) {
        // Po rotaci se wear rates vymění
        const remainingLifeAfterRotation = (currentDepthInner - TyreMin) / wearRateOuter;
        theoreticalTotalMileageWithRotation = (
          D +
          remainingLifeAfterRotation +
          (initialDepthOuter - currentDepthOuter) / wearRateInner
        ).toFixed(2);
      } else {
        theoreticalTotalMileageWithRotation = theoreticalTotalMileageNoRotation;
      }

      // Náklady na 1 km bez rotace
      let costPerKmNoRotation = 'N/A';
      if (isDemounted) {
        // Pro demontované pneumatiky vypočítáme náklady na km přímo z ceny a ujeté vzdálenosti
        const distance = tyre.demountedAtOdo - tyre.mountedAtOdo;
        if (distance > 0) {
          costPerKmNoRotation = (tyre.tyrePrice / distance).toFixed(2);
        }
      } else if (theoreticalTotalMileageNoRotation !== 'N/A' && theoreticalTotalMileageNoRotation > 0) {
        costPerKmNoRotation = (tyre.tyrePrice / theoreticalTotalMileageNoRotation).toFixed(2);
      }

      // Náklady na 1 km s rotací
      let costPerKmWithRotation = 'N/A';
      if (
        D !== null &&
        theoreticalTotalMileageWithRotation !== 'N/A' &&
        theoreticalTotalMileageWithRotation > 0
      ) {
        costPerKmWithRotation = (tyre.tyrePrice / theoreticalTotalMileageWithRotation).toFixed(2);
      } else {
        costPerKmWithRotation = costPerKmNoRotation;
      }

      // Doporučená rotace při stavu tachometru
      let recommendedRotationOdometer = 'N/A';
      if (D !== null) {
        recommendedRotationOdometer = (currentOdometer + D).toFixed(2);
      }

      // Zbývající nájezd bez rotace
      let remainingMileageNoRotation = 'N/A';
      if (
        theoreticalTotalMileageNoRotation !== 'N/A' &&
        theoreticalTotalMileageNoRotation > 0 &&
        currentOdometer !== null &&
        tyre.mountedAtOdo !== null
      ) {
        remainingMileageNoRotation = (
          theoreticalTotalMileageNoRotation -
          (currentOdometer - tyre.mountedAtOdo)
        ).toFixed(2);
      }

      // Zbývající nájezd s rotací
      let remainingMileageWithRotation = 'N/A';
      if (
        theoreticalTotalMileageWithRotation !== 'N/A' &&
        theoreticalTotalMileageWithRotation > 0 &&
        currentOdometer !== null &&
        tyre.mountedAtOdo !== null
      ) {
        remainingMileageWithRotation = (
          theoreticalTotalMileageWithRotation -
          (currentOdometer - tyre.mountedAtOdo)
        ).toFixed(2);
      }

      // Úspora Kč
      let savings = 'N/A';
      if (
        theoreticalTotalMileageWithRotation !== 'N/A' &&
        theoreticalTotalMileageNoRotation !== 'N/A' &&
        costPerKmWithRotation !== 'N/A'
      ) {
        savings = (
          (parseFloat(theoreticalTotalMileageWithRotation) - parseFloat(theoreticalTotalMileageNoRotation)) *
          parseFloat(costPerKmWithRotation)
        ).toFixed(2);
      }

      // Upozornění
      const warnings = [];
      if (currentDepthOuter <= TyreMin || currentDepthInner <= TyreMin) {
        warnings.push('Pneumatika je ojetá!');
      }

      // Přidání analýzy pro tuto pneumatiku
      analysis.push({
        TyreNo: tyre.TyreNo,
        position: tyre.position,
        tyreName: tyre.tyreName,
        currentDepthOuter: currentDepthOuter.toFixed(2),
        currentDepthInner: currentDepthInner.toFixed(2),
        remainingMileageNoRotation: remainingMileageNoRotation,
        remainingMileageWithRotation: remainingMileageWithRotation,
        theoreticalTotalMileageNoRotation: theoreticalTotalMileageNoRotation,
        theoreticalTotalMileageWithRotation: theoreticalTotalMileageWithRotation,
        costPerKmNoRotation: costPerKmNoRotation,
        costPerKmWithRotation: costPerKmWithRotation,
        savings: savings,
        recommendedRotationOdometer: recommendedRotationOdometer,
        warnings: warnings.length > 0 ? warnings.join(' ') : 'N/A'
      });
    });

    return analysis;
  };

  const handleCloseAnalysis = () => {
    setOpenAnalysis(false);
  };

  return (
    <Paper sx={{ padding: 2 }}>
      <Typography variant="h6">Měření pneumatik pro vozidlo {RZ}</Typography>
      <TableContainer component={Paper} sx={{ marginTop: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Pozice</TableCell>
              <TableCell>Název pneumatiky</TableCell>
              <TableCell>Ideální tlak (bar)</TableCell>
              <TableCell>Hloubka vnější drážky (mm)</TableCell>
              <TableCell>Hloubka střední drážky (mm)</TableCell>
              <TableCell>Hloubka vnitřní drážky (mm)</TableCell>
              <TableCell>Naměřený tlak (bar)</TableCell>
              <TableCell>Tlak z TPMS senzoru (bar)</TableCell>
              <TableCell>Pneumatika otočena</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tyreData.map((tyre, index) => (
              <TableRow key={`${tyre.tyre_list?.TyreNo || index}-${tyre.tyre_position}`}>
                <TableCell>{tyre.tyre_position || 'N/A'}</TableCell>
                <TableCell>{tyre.tyre_list?.TyreName || tyre.tyre_data?.TyreName || 'N/A'}</TableCell>
                <TableCell>{tyre.tyre_data?.idealPressure || 'N/A'}</TableCell>
                <TableCell>{tyre.outer_tread_depth !== undefined ? tyre.outer_tread_depth : 'N/A'}</TableCell>
                <TableCell>{tyre.center_tread_depth !== undefined ? tyre.center_tread_depth : 'N/A'}</TableCell>
                <TableCell>{tyre.inner_tread_depth !== undefined ? tyre.inner_tread_depth : 'N/A'}</TableCell>
                <TableCell>{tyre.measured_pressure !== undefined ? tyre.measured_pressure : 'N/A'}</TableCell>
                <TableCell>
                  {tyre.tpms_pressure !== null && tyre.tpms_pressure !== undefined
                    ? tyre.tpms_pressure
                    : 'N/A'}
                </TableCell>
                <TableCell>{tyre.tyre_rotated ? 'Ano' : 'Ne'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Box mt={2} display="flex" justifyContent="space-between">
        <Button variant="contained" color="primary" onClick={handleOpenAnalysis}>
          Zobrazit analýzu
        </Button>
        <Button variant="contained" color="secondary" onClick={closeMeasurement}>
          Zavřít
        </Button>
      </Box>

      {/* Modální okno pro analýzu */}
      <Modal
        open={openAnalysis}
        onClose={handleCloseAnalysis}
        closeAfterTransition
        BackdropComponent={Backdrop}
        BackdropProps={{
          timeout: 500
        }}
      >
        <Fade in={openAnalysis}>
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '95%',
              bgcolor: 'background.paper',
              boxShadow: 24,
              p: 4,
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <Typography variant="h6" mb={2}>
              Kompletní analýza pneumatik pro vozidlo {RZ}
            </Typography>

            {/* Aktuální pneumatiky */}
            <Typography variant="h6">Aktuální pneumatiky</Typography>
            {analysisData.current.length > 0 ? (
              <TableContainer component={Paper} sx={{ marginTop: 2 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>TyreNo</TableCell>
                      <TableCell>Pozice</TableCell>
                      <TableCell>Název pneumatiky</TableCell>
                      <TableCell>Aktuální hloubka vnější drážky (mm)</TableCell>
                      <TableCell>Aktuální hloubka vnitřní drážky (mm)</TableCell>
                      <TableCell>Zbývající nájezd bez rotace (km)</TableCell>
                      <TableCell>Zbývající nájezd s rotací (km)</TableCell>
                      <TableCell>Teoretický celkový nájezd bez rotace (km)</TableCell>
                      <TableCell>Teoretický celkový nájezd s rotací (km)</TableCell>
                      <TableCell>Úspora Kč</TableCell>
                      <TableCell>Náklady na 1 km bez rotace (Kč)</TableCell>
                      <TableCell>Náklady na 1 km s rotací (Kč)</TableCell>
                      <TableCell>Doporučená rotace při stavu tachometru (km)</TableCell>
                      <TableCell>Upozornění</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analysisData.current.map((tyre, index) => (
                      <TableRow key={`${tyre.TyreNo}-${tyre.position}-${index}`}>
                        <TableCell>{tyre.TyreNo}</TableCell>
                        <TableCell>{tyre.position}</TableCell>
                        <TableCell>{tyre.tyreName}</TableCell>
                        <TableCell>{tyre.currentDepthOuter}</TableCell>
                        <TableCell>{tyre.currentDepthInner}</TableCell>
                        <TableCell>{tyre.remainingMileageNoRotation}</TableCell>
                        <TableCell>{tyre.remainingMileageWithRotation}</TableCell>
                        <TableCell>{tyre.theoreticalTotalMileageNoRotation}</TableCell>
                        <TableCell>{tyre.theoreticalTotalMileageWithRotation}</TableCell>
                        <TableCell>{tyre.savings}</TableCell>
                        <TableCell>{tyre.costPerKmNoRotation}</TableCell>
                        <TableCell>{tyre.costPerKmWithRotation}</TableCell>
                        <TableCell>{tyre.recommendedRotationOdometer}</TableCell>
                        <TableCell>{tyre.warnings}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body1">Žádná data pro aktuální pneumatiky.</Typography>
            )}

            {/* Vyměněné pneumatiky */}
            <Typography variant="h6" mt={4}>
              Vyměněné pneumatiky
            </Typography>
            {analysisData.demounted.length > 0 ? (
              <TableContainer component={Paper} sx={{ marginTop: 2 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>TyreNo</TableCell>
                      <TableCell>Pozice</TableCell>
                      <TableCell>Název pneumatiky</TableCell>
                      <TableCell>Aktuální hloubka vnější drážky (mm)</TableCell>
                      <TableCell>Aktuální hloubka vnitřní drážky (mm)</TableCell>
                      <TableCell>Zbývající nájezd bez rotace (km)</TableCell>
                      <TableCell>Zbývající nájezd s rotací (km)</TableCell>
                      <TableCell>Teoretický celkový nájezd bez rotace (km)</TableCell>
                      <TableCell>Teoretický celkový nájezd s rotací (km)</TableCell>
                      <TableCell>Úspora Kč</TableCell>
                      <TableCell>Náklady na 1 km bez rotace (Kč)</TableCell>
                      <TableCell>Náklady na 1 km s rotací (Kč)</TableCell>
                      <TableCell>Doporučená rotace při stavu tachometru (km)</TableCell>
                      <TableCell>Upozornění</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analysisData.demounted.map((tyre, index) => (
                      <TableRow key={`${tyre.TyreNo}-${tyre.position}-${index}`}>
                        <TableCell>{tyre.TyreNo}</TableCell>
                        <TableCell>{tyre.position}</TableCell>
                        <TableCell>{tyre.tyreName}</TableCell>
                        <TableCell>{tyre.currentDepthOuter}</TableCell>
                        <TableCell>{tyre.currentDepthInner}</TableCell>
                        <TableCell>{tyre.remainingMileageNoRotation}</TableCell>
                        <TableCell>{tyre.remainingMileageWithRotation}</TableCell>
                        <TableCell>{tyre.theoreticalTotalMileageNoRotation}</TableCell>
                        <TableCell>{tyre.theoreticalTotalMileageWithRotation}</TableCell>
                        <TableCell>{tyre.savings}</TableCell>
                        <TableCell>{tyre.costPerKmNoRotation}</TableCell>
                        <TableCell>{tyre.costPerKmWithRotation}</TableCell>
                        <TableCell>{tyre.recommendedRotationOdometer}</TableCell>
                        <TableCell>{tyre.warnings}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body1">Žádná data pro vyměněné pneumatiky.</Typography>
            )}

            <Box mt={2} display="flex" justifyContent="flex-end">
              <Button variant="contained" onClick={handleCloseAnalysis}>
                Zavřít analýzu
              </Button>
            </Box>
          </Box>
        </Fade>
      </Modal>
    </Paper>
  );
};

export default TyreMeasurement;
