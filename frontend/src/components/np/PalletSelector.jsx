// PalletSelector.jsx
import { Card, Box, Typography, Button, Collapse, Chip, Stack } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { getScanState, STATE_BG, STATE_FG } from "../../utils/scanState";

export default function PalletSelector({
  uniqNos, selNo, setSelNo, collapsed, setCollapsed,
  palletNoStats = {}
}) {
  // Vypočti celkové sumy pro tlačítko "Všechny"
  const total = Object.values(palletNoStats).reduce((s, v) => {
    s.scanned += v.scanned || 0; s.ordered += v.ordered || 0; return s;
  }, { scanned:0, ordered:0 });
  const allState = getScanState(total.scanned, total.ordered);

  return (
    <Card variant="outlined" sx={{ p:2, mb:2 }}>
      <Box display="flex" alignItems="center" mb={1}>
        <Typography sx={{ flexGrow:1 }}>Vyber paletu:</Typography>
        <Button size="small"
          startIcon={collapsed ? <ExpandMoreIcon/> : <ExpandLessIcon/>}
          onClick={()=>setCollapsed(v=>!v)}
        >
          {collapsed ? "Rozbalit" : "Skrýt"}
        </Button>
      </Box>

      <Collapse in={!collapsed}>
        <Box sx={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:1}}>
          <Button
            variant={selNo===""?"contained":"outlined"}
            onClick={()=>setSelNo("")}
            sx={{
              justifyContent:"space-between",
              bgcolor: STATE_BG[allState],
              color  : STATE_FG[allState]
            }}
          >
            Všechny
            <Chip size="small" label={`${total.scanned}/${total.ordered}`} sx={{ ml:1 }} />
          </Button>

          {uniqNos.map(n=>{
            const st = palletNoStats[String(n)] || { scanned:0, ordered:0 };
            const state = getScanState(st.scanned, st.ordered);
            return (
              <Button
                key={n}
                variant={selNo===n?"contained":"outlined"}
                onClick={()=>setSelNo(n)}
                sx={{
                  justifyContent:"space-between",
                  bgcolor: STATE_BG[state],
                  color  : STATE_FG[state]
                }}
              >
                {n}
                <Chip size="small" label={`${st.scanned}/${st.ordered}`} sx={{ ml:1 }} />
              </Button>
            );
          })}
        </Box>
      </Collapse>

      <Typography variant="caption" sx={{ mt:1, display:"block" }}>
        Po naskenování EAN se okamžitě přičte 1 krabice a otevře se vážicí modal.
      </Typography>
    </Card>
  );
}
