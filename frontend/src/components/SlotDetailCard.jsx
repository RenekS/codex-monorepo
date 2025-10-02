// SlotDetailCard.jsx
import React from 'react';
import { Box, Typography, Divider, Stack, Chip } from '@mui/material';

export default function SlotDetailCard({
  displayName,
  slot,
  cartons = 0,
  sachets = 0,
  meta, // volitelné: např. { unitsPerCarton, sachetsPerCarton, unitsPerSachet, name }
}) {
  const hasSachets = sachets > 0;

  return (
    <Box sx={{ p: 1.2, minWidth: 240 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {displayName || slot?.slot_name}
        </Typography>
        {slot?.status && (
          <Chip
            size="small"
            label={slot.status}
            sx={{ height: 20 }}
          />
        )}
      </Stack>

      {slot?.product_id && (
        <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.8 }}>
          {meta?.name ? `${meta.name} • ${slot.product_id}` : slot.product_id}
        </Typography>
      )}

      <Divider sx={{ my: 1 }} />

      <Stack direction="row" spacing={2}>
        <Box>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            Krabice (celé)
          </Typography>
          <Typography variant="h6" sx={{ mt: -0.5 }}>{cartons}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            Sáčky (volné)
          </Typography>
          <Typography variant="h6" sx={{ mt: -0.5 }}>{hasSachets ? sachets : 0}</Typography>
        </Box>
      </Stack>

      {meta && (
        <>
          <Divider sx={{ my: 1 }} />
          <Stack spacing={0.5}>
            {meta.unitsPerCarton != null && (
              <Typography variant="caption">
                {`Kusů v krabici: ${meta.unitsPerCarton}`}
              </Typography>
            )}
            {meta.sachetsPerCarton != null && (
              <Typography variant="caption">
                {`Sáčků v krabici: ${meta.sachetsPerCarton}`}
              </Typography>
            )}
            {meta.unitsPerSachet != null && (
              <Typography variant="caption">
                {`Kusů v sáčku: ${meta.unitsPerSachet}`}
              </Typography>
            )}
          </Stack>
        </>
      )}

      {slot?.updated_at && (
        <>
          <Divider sx={{ my: 1 }} />
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            Aktualizováno: {new Date(slot.updated_at).toLocaleString()}
          </Typography>
        </>
      )}
    </Box>
  );
}
