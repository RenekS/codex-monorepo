import React, { useState } from 'react';
import axios from 'axios';
import { Calendar as BigCalendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/cs'; // Přidáno: import češtiny pro moment.js
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { saveAs } from 'file-saver';
import { IconButton, Tooltip } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';

moment.locale('cs'); // Nastavení češtiny jako výchozího jazyka pro moment.js
const localizer = momentLocalizer(moment);

const Calendar = () => {
  const [dayFrom, setDayFrom] = useState('');
  const [dayTo, setDayTo] = useState('');
  const [calendarData, setCalendarData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date()); // Uložení aktuálně zobrazeného dne

  // Definice slotů jako zdrojů
  const slotResources = [
    { id: 1350, name: 'Pneuservis Pavlenko' },
    { id: 5185, name: 'Pneuservis Mrázek' },
    { id: 5186, name: 'Pneuservis Kundera' },
    { id: 5183, name: 'Nákladní pneuservis' },
    { id: 1351, name: 'Autoservis Mrázek' },
    { id: 5191, name: 'Autoservis Kundera' },
    { id: 2854, name: 'Geometrie' },
    { id: 5370, name: 'Rezervace ONLINE' },
  ];

  const getSlotName = (slotID) => {
    const slot = slotResources.find((s) => s.id === slotID);
    return slot ? slot.name : `Slot ${slotID}`;
  };

  const fetchCalendarData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/B4S_getData`, {
        params: {
          dayFrom,
          dayTo,
        },
      });

      const formattedData = response.data.A.map((booking) => {
        const startDate = new Date(booking.day);
        const endDate = new Date(startDate.getTime() + booking.duration * 60000);

        return {
          id: booking.bookingID,
          title: booking.name || `SPZ: ${booking.spz}`,
          start: startDate,
          end: endDate,
          resourceId: booking.slotID,
          slotName: getSlotName(booking.slotID),
          booking,
        };
      });
      setCalendarData(formattedData);
    } catch (err) {
      setError('Chyba při načítání dat z kalendáře.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEvent = (event) => {
    generatePDFForBookings([event.booking]);
  };

  const handlePrintForSlot = (slotID) => {
    const selectedDay = new Date(currentDate).setHours(0, 0, 0, 0);
    const bookingsForSlot = calendarData.filter(
      (booking) =>
        booking.resourceId === slotID &&
        booking.booking.spz !== 'INTERNAL' &&
        new Date(booking.start).setHours(0, 0, 0, 0) === selectedDay
    );
    generatePDFForBookings(bookingsForSlot.map((b) => b.booking), getSlotName(slotID));
  };

  const handlePrintAll = () => {
    const selectedDay = new Date(currentDate).setHours(0, 0, 0, 0);
    const allBookings = calendarData
      .filter(
        (booking) =>
          booking.booking.spz !== 'INTERNAL' &&
          new Date(booking.start).setHours(0, 0, 0, 0) === selectedDay
      )
      .map((booking) => booking.booking);
    generatePDFForBookings(allBookings, 'Servisni_listy');
  };

  const generatePDFForBookings = async (bookings, fileNamePrefix) => {
    try {
      // Načíst šablonu montážního listu jako ArrayBuffer
      const existingPdfBytes = await fetch('/files/formular-servis-hotovy.pdf').then((res) =>
        res.arrayBuffer()
      );

      // Načtení LiberationSans-Bold fontu
      const liberationSansBoldBytes = await fetch('/fonts/LiberationSans-Bold.ttf').then((res) =>
        res.arrayBuffer()
      );

      // Vytvoření nového PDF dokumentu pro sloučení
      const mergedPdf = await PDFDocument.create();
      mergedPdf.registerFontkit(fontkit);
      const liberationSansBoldFont = await mergedPdf.embedFont(liberationSansBoldBytes);

      for (const booking of bookings) {
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        pdfDoc.registerFontkit(fontkit);

        const font = await pdfDoc.embedFont(liberationSansBoldBytes);

        // Vyplnění předem připravených editovatelných polí
        const form = pdfDoc.getForm();
        const companyField = form.getTextField('Společnost');
        const spzField = form.getTextField('SPZ');
        const fleetField = form.getTextField('Firma/fleet');
        const approvalField = form.getTextField('č. schválení');
        const nameField = form.getTextField('jméno/příjmení');
        const phoneField = form.getTextField('telefon');
        const emailField = form.getTextField('email');
        const reasonField = form.getTextField('Důvod návštěvy');

        companyField.setText(booking.company || '');
        spzField.setText(booking.spz || '');
        fleetField.setText(booking.company || '');
        approvalField.setText(booking.bookingID || '');
        nameField.setText(booking.name || '');
        phoneField.setText(booking.phone || '');
        emailField.setText(booking.email || '');
        reasonField.setText(
          `${booking.carsizeName || ''}, ${booking.duration || ''} minut, ${booking.taskGrpName || ''}`
        );

        // Aktualizace vzhledu všech polí
        form.updateFieldAppearances(font);

        // Získání všech stránek z pdfDoc
        const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      // Uložení sloučeného PDF jako Blob a automatické stažení
      const pdfBytes = await mergedPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const date = new Date().toLocaleDateString('cs-CZ');
      saveAs(blob, `${fileNamePrefix} - ${date}.pdf`);
    } catch (error) {
      console.error('Chyba při generování PDF:', error);
    }
  };

  // Vytvoření vlastní komponenty ResourceHeader
  const ResourceHeader = ({ label, resource }) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
      }}
    >
      <Tooltip title="Tisknout všechny pozice ve slotu">
        <IconButton onClick={() => handlePrintForSlot(resource.id)}>
          <PrintIcon />
        </IconButton>
      </Tooltip>
      <span>{label}</span>
    </div>
  );

  return (
    <div>
      <h1>Kalendář rezervací</h1>
      <div>
        <label>
          Od:
          <input type="date" value={dayFrom} onChange={(e) => setDayFrom(e.target.value)} />
        </label>
        <label>
          Do:
          <input type="date" value={dayTo} onChange={(e) => setDayTo(e.target.value)} />
        </label>
        <button onClick={fetchCalendarData}>Načíst data</button>
        <Tooltip title="Tisknout všechny sloty">
          <IconButton onClick={handlePrintAll}>
            <PrintIcon />
          </IconButton>
        </Tooltip>
      </div>
      {loading && <p>Načítám data...</p>}
      {error && <p>{error}</p>}
      {calendarData.length > 0 && (
        <div style={{ height: 700 }}>
          <BigCalendar
            localizer={localizer}
            events={calendarData}
            startAccessor="start"
            endAccessor="end"
            defaultView={Views.DAY}
            views={[Views.DAY]}
            resources={slotResources}
            resourceIdAccessor="id"
            resourceTitleAccessor="name"
            style={{ height: 700 }}
            onSelectEvent={handleSelectEvent}
            onNavigate={(date) => setCurrentDate(date)}
            components={{
              resourceHeader: ResourceHeader,
            }}
            min={new Date(1970, 1, 1, 7, 0, 0)} // Nastavení minimálního času na 7:00
            max={new Date(1970, 1, 1, 18, 0, 0)} // Nastavení maximálního času na 18:00
            formats={{
              timeGutterFormat: 'HH:mm',
              eventTimeRangeFormat: ({ start, end }, culture, localizer) =>
                localizer.format(start, 'HH:mm', culture) +
                ' – ' +
                localizer.format(end, 'HH:mm', culture),
              agendaTimeFormat: 'HH:mm',
              agendaTimeRangeFormat: ({ start, end }, culture, localizer) =>
                localizer.format(start, 'HH:mm', culture) +
                ' – ' +
                localizer.format(end, 'HH:mm', culture),
            }}
          />
        </div>
      )}
    </div>
  );
};

export default Calendar;
