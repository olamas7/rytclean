import { useLocation, useNavigate } from 'react-router-dom';

const originKey = 'rytcleanInlineOrigin';
const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
export const inlineView = (search, parameter, sections) => {
    const value = new URLSearchParams(search).get(parameter);
    return value && owns(sections, value) ? value : '';
};

export function inlineDestination(location, { sections, parameter = 'view', contextKeys = [] }, nextView, values = {}) {
    if (nextView && !owns(sections, nextView)) throw new Error('Unknown inline section.');
    const params = new URLSearchParams(location.search);
    contextKeys.forEach((key) => params.delete(key));
    if (nextView) params.set(parameter, nextView);
    else params.delete(parameter);
    Object.entries(values).forEach(([key, value]) => { if (contextKeys.includes(key) && value !== undefined && value !== null) params.set(key, String(value)); });
    return { pathname: location.pathname, search: params.size ? `?${params}` : '', hash: location.hash || '' };
}

export function inlineParent(location, configuration) {
    const { sections, parameter = 'view' } = configuration;
    const view = inlineView(location.search, parameter, sections);
    const parent = sections[view]?.parent || '';
    const origin = location.state?.[originKey];
    const fromInline = Boolean(origin && origin.pathname === location.pathname && origin.parameter === parameter && origin.view === parent && inlineView(origin.search, parameter, sections) === parent);
    const parentValues = Object.fromEntries((sections[parent]?.contextKeys || []).map((key) => [key, new URLSearchParams(location.search).get(key)]));
    return fromInline
        ? { fromInline, target: { pathname: origin.pathname, search: origin.search, hash: origin.hash }, state: origin.state }
        : { fromInline, target: inlineDestination(location, configuration, parent, parentValues), state: null };
}

// URL-backed sections keep refresh/deep links working. Only this page's own
// openings use browser Back; direct links fall back to their declared parent.
export default function useInlineNavigation({ sections, rootLabel, parameter = 'view', contextKeys = [], blocked = false }) {
    const location = useLocation();
    const navigate = useNavigate();
    const configuration = { sections, parameter, contextKeys };
    const view = inlineView(location.search, parameter, sections);
    const goBack = () => {
        if (!view) return;
        const parent = inlineParent(location, configuration);
        if (parent.fromInline) navigate(-1);
        else navigate(parent.target, { replace: true, state: parent.state });
    };
    const back = () => { if (!blocked) goBack(); };
    const open = (nextView, values = {}) => {
        if (blocked) return;
        navigate(inlineDestination(location, configuration, nextView, values), { state: {
            ...location.state,
            [originKey]: { pathname: location.pathname, parameter, view, search: location.search, hash: location.hash || '', state: location.state }
        } });
    };
    const parent = sections[view]?.parent;
    return { view, params: new URLSearchParams(location.search), open, back,
        // Successful saves may close while pending state is still being cleared.
        close: goBack,
        navigation: { active: Boolean(view), view, parentLabel: parent ? sections[parent].label : rootLabel, onBack: back, disabled: blocked } };
}
