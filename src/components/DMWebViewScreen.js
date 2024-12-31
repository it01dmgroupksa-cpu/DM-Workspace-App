import React, { useState, useRef } from 'react';
import { StyleSheet, View, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react-native';

const DMWebViewScreen = () => {
  const [loadError, setLoadError] = useState(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const webViewRef = useRef(null);

  const LoadingIndicatorView = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator color="#153156" size="large" />
      <Text>Loading...</Text>
    </View>
  );

  const handleLoadError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.error('WebView load error:', nativeEvent);
    setLoadError(nativeEvent.description || 'Unknown error');
  };

  const handleHttpError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.warn('WebView HTTP error:', nativeEvent);
  };

  const handleNavigationStateChange = (navState) => {
    setCanGoBack(navState.canGoBack);
    setCanGoForward(navState.canGoForward);
  };

  const NavigationButtons = () => (
    <View style={styles.navigationContainer}>
      <TouchableOpacity 
        style={[styles.navButton, !canGoBack && styles.disabledButton]} 
        onPress={() => webViewRef.current?.goBack()}
        disabled={!canGoBack}
      >
        <ArrowLeft 
          size={24} 
          color={canGoBack ? "#153156" : "#ccc"}
        />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.navButton}
        onPress={() => webViewRef.current?.reload()}
      >
        <RefreshCw 
          size={24} 
          color="#153156"
        />
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.navButton, !canGoForward && styles.disabledButton]}
        onPress={() => webViewRef.current?.goForward()}
        disabled={!canGoForward}
      >
        <ArrowRight 
          size={24} 
          color={canGoForward ? "#153156" : "#ccc"}
        />
      </TouchableOpacity>
    </View>
  );

  if (loadError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load page</Text>
        <Text>{loadError}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NavigationButtons />
      <WebView
        ref={webViewRef}
        source={{
          uri: 'https://dmgroup.frappe.cloud/app',
          headers: {
            'User-Agent': 'Chrome/91.0.4472.124'  
          }
        }}
        mixedContentMode="always"
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={LoadingIndicatorView}
        onError={handleLoadError}
        onHttpError={handleHttpError}
        onNavigationStateChange={handleNavigationStateChange}
        style={styles.webView}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: 'red',
    marginBottom: 10,
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  navButton: {
    padding: 10,
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default DMWebViewScreen;