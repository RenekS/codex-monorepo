import React, { useEffect, useState } from 'react';
import { Box, Card, CardHeader, CardContent, Table, TableHead, TableRow, TableCell, TableBody, IconButton, TextField } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';

const ServiceTasksSection = ({ serviceTasks, updateTaskCount, updateNote, toggleNoteActive, activeFunctions }) => {
  const [filteredTasks, setFilteredTasks] = useState([]);

  useEffect(() => {
    const filterTasks = () => {
      if (activeFunctions.tpms && activeFunctions.measurement && activeFunctions.repair) {
        return serviceTasks.filter(task => ['TPMS', 'Standardní', 'Měření', 'Oprava'].includes(task.type));
      } else if (activeFunctions.tpms && activeFunctions.measurement) {
        return serviceTasks.filter(task => ['TPMS', 'Standardní', 'Měření'].includes(task.type));
      } else if (activeFunctions.tpms && activeFunctions.repair) {
        return serviceTasks.filter(task => ['TPMS', 'Standardní', 'Oprava'].includes(task.type));
      } else if (activeFunctions.measurement && activeFunctions.repair) {
        return serviceTasks.filter(task => ['Měření', 'Standardní', 'Oprava'].includes(task.type));
      } else if (activeFunctions.tpms) {
        return serviceTasks.filter(task => ['TPMS', 'Standardní'].includes(task.type));
      } else if (activeFunctions.measurement) {
        return serviceTasks.filter(task => ['Měření', 'Standardní'].includes(task.type));
      } else if (activeFunctions.repair) {
        return serviceTasks.filter(task => ['Oprava', 'Standardní'].includes(task.type));
      } else {
        return serviceTasks.filter(task => task.type === 'Standardní');
      }
    };
    setFilteredTasks(filterTasks());
  }, [serviceTasks, activeFunctions]);

  return (
    <Card sx={{ height: '100%', overflow: 'auto', width: '100%' }}>
      <CardHeader title="Úkony Servisu" />
      <CardContent>
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Úkon</TableCell>
                <TableCell>Počet</TableCell>
                <TableCell>Pozn.</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredTasks.map(task => (
                <React.Fragment key={task.id}>
                  <TableRow>
                    <TableCell>{task.name}</TableCell>
                    <TableCell className="count-control">
                      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
                        <IconButton onClick={() => updateTaskCount(task.id, task.count - 1)}>
                          <RemoveIcon />
                        </IconButton>
                        <TextField
                          type="number"
                          className="task-count-input"
                          value={task.count}
                          onChange={e => updateTaskCount(task.id, parseInt(e.target.value) || 0)}
                          sx={{ width: '50px', textAlign: 'center' }}
                        />
                        <IconButton onClick={() => updateTaskCount(task.id, task.count + 1)}>
                          <AddIcon />
                        </IconButton>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={task.noteActive}
                        onChange={() => toggleNoteActive(task.id)}
                      />
                    </TableCell>
                  </TableRow>
                  {task.noteActive && (
                    <TableRow>
                      <TableCell colSpan="3">
                        <TextField
                          className="form-control"
                          placeholder="Poznámka"
                          value={task.note || ''}
                          onChange={e => updateNote(task.id, e.target.value)}
                          fullWidth
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </Box>
      </CardContent>
    </Card>
  );
};

export default ServiceTasksSection;
