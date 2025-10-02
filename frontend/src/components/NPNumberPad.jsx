import React, { useState } from "react";
import { Box, Button, TextField } from "@mui/material";

export default function NPNumberPad({ initialValue, onSubmit, onCancel }) {
  const [val, setVal] = useState(initialValue.toString());
  const write = (n) => setVal((p) => (p === "0" ? n.toString() : p + n));
  const back  = () => setVal((p) => (p.length > 1 ? p.slice(0, -1) : "0"));

  return (
    <Box textAlign="center">
      <TextField
        value={val}
        InputProps={{ readOnly: true, sx: { textAlign: "center" } }}
        sx={{ width: "100%", mb: 2, fontSize: "1.5rem" }}
      />
      <Box sx={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:1 }}>
        {[1,2,3,4,5,6,7,8,9,0].map((n)=>(
          <Button key={n} variant="outlined" onClick={()=>write(n)}>{n}</Button>
        ))}
      </Box>
      <Box mt={2} display="flex" justifyContent="space-between">
        <Button onClick={()=>setVal("0")}>C</Button>
        <Button onClick={back}>←</Button>
        <Button variant="contained" color="success" onClick={()=>onSubmit(parseInt(val,10))}>
          Potvrdit
        </Button>
        <Button color="error" onClick={onCancel}>Zrušit</Button>
      </Box>
    </Box>
  );
}