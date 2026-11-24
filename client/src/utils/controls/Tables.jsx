import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  InputAdornment,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Typography
} from '@mui/material';
import { FilterList, Search } from '@mui/icons-material';
import DataState from 'ui-component/DataState';
import { LdButton } from 'utils/myButtons';

// Shared visual tokens follow the user-provided table reference.
const tableColors = { ink: '#192b60', muted: '#74829a', border: '#e8eef8', outline: '#cdd7e7', header: '#f3f6fc' };
const compactInputSx = {
  '& .MuiOutlinedInput-root': {
    height: 36,
    borderRadius: '13px',
    bgcolor: '#f8faff',
    fontSize: '0.75rem',
    color: tableColors.ink,
    '& fieldset': { borderColor: tableColors.outline },
    '&:hover fieldset': { borderColor: 'primary.main' }
  },
  '& .MuiOutlinedInput-input': { py: 1, bgcolor: 'transparent' },
  '& .MuiInputAdornment-root': { color: tableColors.muted },
  '& .MuiSvgIcon-root': { fontSize: 16 }
};

export const TableToolbar = ({ title, count, searchValue = '', onSearchChange, searchLabel = 'Search records', filters, actions }) => (
  <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: { xs: 1.5, md: 2 }, px: 2, py: 1.5, minHeight: 90 }}>
    {title && <Typography component="h2" sx={{ flex: { xs: '1 0 100%', lg: '1 0 220px' }, fontSize: '0.875rem', fontWeight: 700, color: tableColors.ink }}>
      {title}{typeof count === 'number' ? ` (${count})` : ''}
    </Typography>}
    <Box sx={{ flex: '1 1 600px', minWidth: 0 }}>
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
    {onSearchChange && (
      <TextField
        size="small"
        placeholder={searchLabel}
        inputProps={{ 'aria-label': searchLabel }}
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search fontSize="small" />
            </InputAdornment>
          )
        }}
        sx={{ ...compactInputSx, flex: { xs: '1 1 100%', sm: '1 1 210px' }, minWidth: 0 }}
      />
    )}
    {filters}
    </Stack>
    {actions && (
      <Stack direction="row" spacing={0.75} useFlexGap sx={{ mt: 0.5, justifyContent: 'flex-end', flexWrap: 'wrap', '& .MuiButton-root': { minHeight: 30, borderRadius: '10px', fontSize: '0.6875rem', textTransform: 'none', boxShadow: 'none' } }}>
        {actions}
      </Stack>
    )}
    </Box>
  </Box>
);

TableToolbar.propTypes = {
  title: PropTypes.string,
  count: PropTypes.number,
  searchValue: PropTypes.string,
  onSearchChange: PropTypes.func,
  searchLabel: PropTypes.string,
  filters: PropTypes.node,
  actions: PropTypes.node
};

export const TableFilter = ({ label, value, onChange, options = [], allLabel, disabled = false }) => (
  <TextField select size="small" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}
    SelectProps={{ inputProps: { 'aria-label': label } }}
    InputProps={{ startAdornment: <InputAdornment position="start"><FilterList /></InputAdornment> }}
    sx={{ ...compactInputSx, flex: { xs: '1 1 140px', md: '0 1 155px' }, minWidth: 130 }}>
    <MenuItem value="all">{allLabel || `All ${label.toLowerCase()}`}</MenuItem>
    {options.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
  </TextField>
);

TableFilter.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(PropTypes.shape({ value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired, label: PropTypes.string.isRequired })),
  allLabel: PropTypes.string,
  disabled: PropTypes.bool
};

export const TablePrimaryText = ({ primary, secondary, fontSize = 12 }) => (
  <Stack spacing={0.5}>
    <Typography component="span" sx={{ fontSize, fontWeight: 700, color: '#2b507c', lineHeight: 1.4 }}>{primary}</Typography>
    {secondary && <Typography component="span" sx={{ fontSize: Math.max(11, fontSize - 1), color: tableColors.muted, lineHeight: 1.5 }}>{secondary}</Typography>}
  </Stack>
);

TablePrimaryText.propTypes = { primary: PropTypes.node, secondary: PropTypes.node, fontSize: PropTypes.number };

export const TableActionButton = ({ label, icon, disabled = false, tooltip, loading = false, onClick }) => (
  <LdButton variant="outlined" aria-label={label} tooltip={tooltip || label} disabled={disabled} loading={loading} onClick={onClick}
    sx={{ minWidth: { xs: 44, sm: 26 }, width: { xs: 44, sm: 26 }, height: { xs: 44, sm: 26 }, p: 0.5, borderRadius: '5px', borderColor: '#c7dcff', color: '#2674ed', bgcolor: '#f3f8ff', boxShadow: 'none', '& .MuiSvgIcon-root': { fontSize: 15 }, '&:hover': { bgcolor: '#e8f1ff', borderColor: '#8db9ff' }, '&.Mui-disabled': { borderColor: tableColors.border } }}>
    {icon}
  </LdButton>
);

TableActionButton.propTypes = { label: PropTypes.string.isRequired, icon: PropTypes.node.isRequired, disabled: PropTypes.bool, tooltip: PropTypes.string, loading: PropTypes.bool, onClick: PropTypes.func };

const getValue = (row, column) => (column.getValue ? column.getValue(row) : row[column.id]);
const compareValues = (a, b) => {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'en-GH', { numeric: true, sensitivity: 'base' });
};

// Client-side table: supply already-filtered rows; use stable row IDs, never array indexes.
export const AppTable = ({
  columns,
  rows = [],
  getRowId = (row) => row.id,
  ariaLabel,
  loading = false,
  error,
  onRetry,
  emptyTitle = 'No records yet',
  emptyDescription,
  emptyAction,
  toolbar,
  pagination = true,
  defaultRowsPerPage = 10,
  rowsPerPageOptions = [10, 25, 50],
  minWidth = 640,
  fontSize = 12
}) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(defaultRowsPerPage);
  const [sort, setSort] = useState({ id: '', direction: 'asc' });
  const sortedRows = useMemo(() => {
    const column = columns.find((item) => item.id === sort.id);
    if (!column) return rows;
    return [...rows].sort((a, b) => {
      const result = column.compare ? column.compare(a, b) : compareValues(getValue(a, column), getValue(b, column));
      return sort.direction === 'asc' ? result : -result;
    });
  }, [columns, rows, sort]);
  const lastPage = Math.max(0, Math.ceil(rows.length / rowsPerPage) - 1);
  const safePage = Math.min(page, lastPage);
  const visibleRows = pagination ? sortedRows.slice(safePage * rowsPerPage, (safePage + 1) * rowsPerPage) : sortedRows;

  useEffect(() => setPage(0), [rows.length]);

  return (
    <Paper variant="outlined" sx={{ borderRadius: '20px', overflow: 'hidden', minWidth: 0, bgcolor: '#fff', borderColor: '#dce6f5', boxShadow: '0 4px 24px rgba(29, 61, 117, 0.035)' }}>
      {toolbar}
      <TableContainer
        tabIndex={0}
        role="region"
        aria-label={`${ariaLabel} table scroll area`}
        sx={{ overflowX: 'auto', '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 } }}
      >
        <Table
          size="small"
          aria-label={ariaLabel}
          aria-busy={loading}
          sx={{
            minWidth,
            color: tableColors.ink,
            '& th': { bgcolor: tableColors.header, color: '#3d527e', fontSize: Math.max(11, fontSize - 1), fontWeight: 700, whiteSpace: 'nowrap', borderTop: '1px solid', borderTopColor: tableColors.border },
            '& td, & th': { px: 1.25, borderBottomColor: tableColors.border },
            '& th.MuiTableCell-root': { py: 1.25 },
            '& td': { py: 1.5, fontSize, color: tableColors.ink, lineHeight: 1.5, '& .MuiTypography-body2': { fontSize }, '& .MuiTypography-caption': { fontSize: Math.max(11, fontSize - 1), color: tableColors.muted } },
            '& tbody .MuiTableRow-root': { height: 64 },
            '& .MuiTableRow-hover:hover': { bgcolor: '#f8fbff' },
            '& .MuiTableSortLabel-root': { color: 'inherit', '&.Mui-active': { color: tableColors.ink } },
            '& .MuiTableSortLabel-icon': { fontSize: 14 },
            '& tbody tr:last-child td': { borderBottom: 0 }
          }}
        >
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  scope="col"
                  align={column.align || 'left'}
                  sortDirection={sort.id === column.id ? sort.direction : false}
                  sx={{ width: column.width }}
                >
                  {column.sortable ? (
                    <TableSortLabel
                      active={sort.id === column.id}
                      direction={sort.id === column.id ? sort.direction : 'asc'}
                      onClick={() => {
                        setSort({
                          id: column.id,
                          direction: sort.id === column.id && sort.direction === 'asc' ? 'desc' : 'asc'
                        });
                        setPage(0);
                      }}
                    >
                      {column.label}
                    </TableSortLabel>
                  ) : (
                    column.label
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              Array.from({ length: Math.min(rowsPerPage, 5) }, (_, index) => (
                <TableRow key={index}>
                  {columns.map((column) => (
                    <TableCell key={column.id}>
                      <Skeleton aria-hidden="true" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : error || !rows.length ? (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <DataState error={error} onRetry={onRetry} title={emptyTitle} description={emptyDescription} action={emptyAction} />
                </TableCell>
              </TableRow>
            ) : (
              visibleRows.map((row) => (
                <TableRow key={getRowId(row)} hover>
                  {columns.map((column) => (
                    <TableCell key={column.id} align={column.align || 'left'}>
                      {column.render ? column.render(row) : (getValue(row, column) ?? '—')}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {loading && (
        <Box role="status" sx={{ px: 2, py: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Loading records…
          </Typography>
        </Box>
      )}
      {pagination && !error && !loading && rows.length > 0 && (
        <TablePagination
          component="div"
          count={rows.length}
          page={safePage}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={rowsPerPageOptions}
          onPageChange={(_, nextPage) => setPage(nextPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number(event.target.value));
            setPage(0);
          }}
          sx={{ borderTop: '1px solid', borderColor: tableColors.border, color: tableColors.muted, '& .MuiTablePagination-toolbar': { flexWrap: 'wrap', minHeight: 48 }, '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': { fontSize: '0.6875rem' } }}
        />
      )}
    </Paper>
  );
};

AppTable.propTypes = {
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      align: PropTypes.oneOf(['left', 'center', 'right']),
      width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      sortable: PropTypes.bool,
      getValue: PropTypes.func,
      render: PropTypes.func,
      compare: PropTypes.func
    })
  ).isRequired,
  rows: PropTypes.array.isRequired,
  getRowId: PropTypes.func,
  ariaLabel: PropTypes.string.isRequired,
  loading: PropTypes.bool,
  error: PropTypes.string,
  onRetry: PropTypes.func,
  emptyTitle: PropTypes.string,
  emptyDescription: PropTypes.string,
  emptyAction: PropTypes.node,
  toolbar: PropTypes.node,
  pagination: PropTypes.bool,
  defaultRowsPerPage: PropTypes.number,
  rowsPerPageOptions: PropTypes.arrayOf(PropTypes.number),
  minWidth: PropTypes.number,
  fontSize: PropTypes.number
};

export default AppTable;
