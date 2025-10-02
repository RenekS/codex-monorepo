import React from "react";
import { Stack, Button, TextField, Typography, Box, LinearProgress } from "@mui/material";
import { UI_DECIMALS } from "./constants";

export default function LiveControls({
  phase, msg, live,
  tolAbs, setTolAbs,
  minPlacedKg, setMinPlacedKg,
  canWeigh,
  onWeighNow,
  onTestPrint
}) {
  return (
    <Box sx={{ flex: 1 }}>
      <Box mt={2} p={2} sx={{ border: "1px dashed #bbb", borderRadius: 1 }}>
        <Typography variant="subtitle2">Živá váha</Typography>
        <Typography sx={{ fontSize: "2rem", fontWeight: 700 }}>
          {live?.measurement != null ? live.measurement.toFixed(UI_DECIMALS) : "—"} kg
        </Typography>
        <Typography variant="caption" color={live?.stable ? "success.main" : "text.secondary"}>
          {live?.stable ? "stabilní" : "—"}
        </Typography>
        {phase === "saving" && <LinearProgress sx={{ mt: 1 }}/>}
        <Typography sx={{ mt: 1 }}>{msg}</Typography>
      </Box>

      <Stack direction={{ xs:"column", sm:"row" }} spacing={2} sx={{ mt: 2 }} alignItems="center">
        <Button
          variant="contained"
          size="large"
          onClick={onWeighNow}
          disabled={!canWeigh || phase === "saving"}
        >
          VÁŽIT
        </Button>

        <Button
          variant="outlined"
          size="large"
          onClick={onTestPrint}
          disabled={phase === "saving"}
        >
          TEST TISK ŠTÍTKU
        </Button>

        <TextField
          label="Tolerance (kg)"
          type="number"
          inputProps={{ step: "0.01", min: "0" }}
          value={tolAbs}
          onChange={(e)=>{ const v = Number(e.target.value); if (!Number.isNaN(v)) setTolAbs(v); }}
          sx={{ width: 160 }}
        />

        <TextField
          label="Min. nárůst pro položení (kg)"
          type="number"
          inputProps={{ step: "0.01", min: "0" }}
          value={minPlacedKg}
          onChange={(e)=>{ const v = Number(e.target.value); if (!Number.isNaN(v)) setMinPlacedKg(v); }}
          sx={{ width: 220 }}
        />
      </Stack>
    </Box>
  );
}
