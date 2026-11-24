import { useEffect, useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Alert, Box, Stack, Typography } from '@mui/material';
import { loadGoogleMaps } from 'services/googleMaps';

const PlaceSearch = ({ onSelect }) => {
    const host = useRef(null);
    const callback = useRef(onSelect);
    callback.current = onSelect;
    const id = useId();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let disposed = false;
        let widget;
        let selected;
        let failed;
        let selectionVersion = 0;
        loadGoogleMaps().then(async (maps) => {
            const { PlaceAutocompleteElement } = await maps.importLibrary('places');
            if (disposed || !host.current) return;
            widget = new PlaceAutocompleteElement({ includedRegionCodes: ['gh'] });
            widget.id = id;
            widget.placeholder = 'Search for a place or address in Ghana';
            widget.setAttribute('aria-label', 'Search location in Ghana');
            widget.style.width = '100%';
            widget.style.colorScheme = 'light';
            selected = async ({ placePrediction }) => {
                const version = ++selectionVersion;
                setLoading(true);
                setError('');
                try {
                    const place = placePrediction.toPlace();
                    // Request only the address and coordinates used by this form.
                    await place.fetchFields({ fields: ['formattedAddress', 'location'] });
                    if (disposed || version !== selectionVersion) return;
                    if (!place.location) throw new Error('No location returned.');
                    callback.current({ latitude: Number(place.location.lat().toFixed(7)), longitude: Number(place.location.lng().toFixed(7)), locationAddress: place.formattedAddress || '' });
                } catch {
                    if (!disposed && version === selectionVersion) setError('Unable to retrieve this place. Try another result or select a map pin manually.');
                } finally {
                    if (!disposed && version === selectionVersion) setLoading(false);
                }
            };
            failed = () => { if (!disposed) { setLoading(false); setError('Place search is unavailable. Enable Places API (New) and check key restrictions, or select a pin manually.'); } };
            widget.addEventListener('gmp-select', selected);
            widget.addEventListener('gmp-error', failed);
            host.current.appendChild(widget);
            setLoading(false);
        }).catch(() => {
            if (!disposed) { setLoading(false); setError('Unable to load place search. You can still choose a map pin or enter coordinates.'); }
        });
        return () => {
            disposed = true;
            widget?.removeEventListener('gmp-select', selected);
            widget?.removeEventListener('gmp-error', failed);
            widget?.remove();
        };
    }, [id]);

    return <Stack spacing={1}>
        <Typography component="label" htmlFor={id} variant="body2">Search location in Ghana</Typography>
        <Box ref={host} sx={{ minHeight: 44, '& gmp-place-autocomplete': { borderRadius: '8px' } }} />
        {loading && <Typography role="status" variant="caption" color="text.secondary">Loading Google Places…</Typography>}
        {error && <Alert severity="warning">{error}</Alert>}
    </Stack>;
};

PlaceSearch.propTypes = { onSelect: PropTypes.func.isRequired };
export default PlaceSearch;
