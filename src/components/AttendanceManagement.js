import React, { useContext, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { checkIn, checkOut } from '../../api';
import { EmployeeContext } from '../context/EmployeeContext';
import { RNCamera } from 'react-native-camera';
import { useNavigation } from '@react-navigation/native'; // Import navigation

// Target location (latitude, longitude)
const TARGET_LOCATION = { latitude: 24.650955513469743, longitude: 46.764160157738324 };

const AttendanceManagement = () => {
  const { employeeDetails } = useContext(EmployeeContext);
  const [location, setLocation] = useState(null);
  const [isWithinRadius, setIsWithinRadius] = useState(false);
  const [distance, setDistance] = useState(null);
  const navigation = useNavigation(); // Use navigation

  useEffect(() => {
    if (!employeeDetails) {
      console.log('No employee details found, fetching...');
    } else {
      console.log('Employee details found:', employeeDetails);
    }
  }, [employeeDetails]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      getLocation();
    }, 5000); // Check location every 5 seconds

    return () => clearInterval(intervalId);
  }, []);

  const getLocation = () => {
    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ latitude, longitude });
        const distanceToTarget = checkProximity(latitude, longitude);
        setDistance(distanceToTarget);
      },
      (error) => console.error(error),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
    );
  };

  const checkProximity = (latitude, longitude) => {
    const distance = getDistanceFromLatLonInKm(
      latitude,
      longitude,
      TARGET_LOCATION.latitude,
      TARGET_LOCATION.longitude
    );
    setIsWithinRadius(distance <= 0.2); // 0.2 km is 200 meters
    return distance;
  };

  const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance;
  };

  const deg2rad = (deg) => {
    return deg * (Math.PI / 180);
  };

  const handleCheckIn = async () => {
    try {
      const result = await checkIn(employeeDetails.name, location);
      Alert.alert('Check-in Successful', 'Attendance recorded successfully.');
    } catch (error) {
      console.error('Check-in Error:', error.response.data);
      Alert.alert('Check-in Failed', `Error: ${error.response.data.message || error.message}`);
    }
  };

  const handleCheckOut = async () => {
    try {
      const result = await checkOut(employeeDetails.name, location);
      Alert.alert('Check-out Successful', 'Attendance recorded successfully.');
    } catch (error) {
      console.error('Check-out Error:', error.response.data);
      Alert.alert('Check-out Failed', `Error: ${error.response.data.message || error.message}`);
    }
  };

  if (!employeeDetails) {
    return (
      <View style={styles.container}>
        <Text>Loading employee details...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <View style={styles.cameraContainer}>
          <RNCamera
            style={styles.camera}
            type={RNCamera.Constants.Type.front}
            captureAudio={false}
          />
          <View style={styles.overlay}>
            <View style={styles.outerCircle}>
              <View style={styles.innerCircle} />
            </View>
          </View>
        </View>
        <View style={styles.locationInfo}>
          <Text style={styles.locationText}>Current Latitude: {location?.latitude}</Text>
          <Text style={styles.locationText}>Current Longitude: {location?.longitude}</Text>
          <Text style={styles.locationText}>Distance to Target: {distance?.toFixed(2)} km</Text>
        </View>
        <TouchableOpacity
          style={[styles.button, !isWithinRadius && styles.disabledButton]}
          onPress={handleCheckIn}
          disabled={!isWithinRadius}
        >
          <Text style={styles.buttonText}>Check In</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, !isWithinRadius && styles.disabledButton]}
          onPress={handleCheckOut}
          disabled={!isWithinRadius}
        >
          <Text style={styles.buttonText}>Check Out</Text>
        </TouchableOpacity>
      </ScrollView>
      <View style={styles.navbar}>
        <TouchableOpacity
          style={styles.navbarButton}
          onPress={() => navigation.navigate('AttendanceManagement')}
        >
          <Text style={styles.navbarButtonText}>Attendance</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navbarButton}
          onPress={() => navigation.navigate('LeaveManagement')}
        >
          <Text style={styles.navbarButtonText}>Leave</Text>
        </TouchableOpacity>
        {/* <TouchableOpacity
          style={styles.navbarButton}
          onPress={() => navigation.navigate('RequestForQuotation')}
        >
          <Text style={styles.navbarButtonText}>Quotation</Text>
        </TouchableOpacity> */}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  cameraContainer: {
    width: '100%',
    height: 300,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#153156',
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  outerCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  locationInfo: {
    marginBottom: 20,
    alignItems: 'center',
  },
  locationText: {
    color: '#153156',
    fontSize: 16,
    marginVertical: 2,
  },
  button: {
    backgroundColor: '#153156',
    paddingVertical: 15,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginVertical: 10,
    elevation: 2,
  },
  disabledButton: {
    backgroundColor: '#A9A9A9', // Disabled button color
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#153156',
    paddingVertical: 10,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  navbarButton: {
    alignItems: 'center',
    flex: 1,
  },
  navbarButtonText: {
    color: '#fff',
    fontSize: 16,
  },
});

export default AttendanceManagement;
