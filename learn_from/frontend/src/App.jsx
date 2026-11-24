import { useSelector } from 'react-redux';
import { RouterProvider } from 'react-router-dom';

import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, StyledEngineProvider } from '@mui/material';

// routing
import router from 'routes';

// defaultTheme
import themes from 'themes';

// project imports
import NavigationScroll from 'layout/NavigationScroll';
import { PWAProvider } from 'utils/context/PWAContext';

// ==============================|| APP ||============================== //

const App = () => {
    const customization = useSelector((state) => state.customization);

    return (
        <StyledEngineProvider injectFirst>
            <ThemeProvider theme={themes(customization)}>
                <CssBaseline />
                <PWAProvider>
                    <NavigationScroll>
                        <RouterProvider router={router} />
                    </NavigationScroll>
                </PWAProvider>
            </ThemeProvider>
        </StyledEngineProvider>
    );
};

export default App;
