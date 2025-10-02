import { Card, Typography, Box } from "@mui/material";

export default function HeaderCard({ header }) {
  if (!header) return null;
  return (
    <Card variant="outlined" sx={{ p:2, mb:3 }}>
      <Typography variant="h5">Dodací list: {header.dodaci_list}</Typography>
      <Typography>Číslo NP: {header.np_number || "—"}</Typography>
      <Typography>Datum: {new Date(header.datum).toLocaleDateString()}</Typography>
      {header.supplier_name    && <Typography>Dodavatel: {header.supplier_name}</Typography>}
      {header.supplier_address && <Typography>Adresa: {header.supplier_address}</Typography>}
    </Card>
  );
}
