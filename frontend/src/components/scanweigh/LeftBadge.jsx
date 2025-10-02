import React, { useMemo } from "react";
import { Box, Typography } from "@mui/material";

export default function LeftBadge({ positionText }) {
  const color = useMemo(() => {
    const n = Number(positionText || 1);
    const hue = ((isFinite(n) ? n : 1) * 47) % 360;
    return `hsl(${hue} 70% 45%)`;
  }, [positionText]);

  return (
    <Box sx={{
      minWidth: 140, maxWidth: 160, flexShrink: 0,
      background: color, color: "#fff",
      display:"flex", alignItems:"center", justifyContent:"center", borderRadius: 1,
    }}>
      <Typography sx={{ fontSize: "6rem", lineHeight: 1, fontWeight: 800 }}>
        {positionText}
      </Typography>
    </Box>
  );
}
