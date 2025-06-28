import React, { createContext, useContext, useState, useEffect } from 'react';
import SplashScreen from '@/components/SplashScreen';
type AppContextType = {
	isAppReady: boolean;
};

const AppContext = createContext<AppContextType>({ isAppReady: false });

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
	const [isAppReady, setIsAppReady] = useState(false);

	useEffect(() => {
		const timer = setTimeout(() => {
			setIsAppReady(true);
		}, 1500); // Splash duration

		return () => clearTimeout(timer);
	}, []);

	return (
		<AppContext.Provider value={{ isAppReady }}>{children}</AppContext.Provider>
	);
};

export const useApp = () => useContext(AppContext);
