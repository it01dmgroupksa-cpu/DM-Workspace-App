import axios from 'axios';
import moment from 'moment';
import React, {useContext, useEffect, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import {checkIn, checkOut, getBranchLocations} from '../../api';
import {EmployeeContext} from '../context/EmployeeContext';
import {RNCamera} from 'react-native-camera';
import {useNavigation} from '@react-navigation/native';

const AttendanceManagement = () => {
  const {employeeDetails} = useContext(EmployeeContext);
  const [location, setLocation] = useState(null);
  const [branchLocations, setBranchLocations] = useState([]);
  const navigation = useNavigation();

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
    }, 5000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    fetchBranchLocations();
  }, []);

  const fetchBranchLocations = async () => {
    try {
      const locations = await getBranchLocations();
      setBranchLocations(locations);
    } catch (error) {
      console.error('Failed to fetch branch locations:', error);
    }
  };

  const getLocation = () => {
    Geolocation.getCurrentPosition(
      position => {
        const {latitude, longitude} = position.coords;
        setLocation({latitude, longitude});
      },
      error => console.error(error),
      {enableHighAccuracy: true, timeout: 20000, maximumAge: 1000},
    );
  };

  const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) *
        Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance;
  };

  const deg2rad = deg => {
    return deg * (Math.PI / 180);
  };

  const canCheckInOrOut = actionType => {
    if (!location) {
      console.log('Location is not available.');
      return false;
    }

    const outsideCheck =
      actionType === 'checkIn'
        ? employeeDetails.custom_outside_check_in
        : employeeDetails.custom_outside_check_out;

    if (outsideCheck) {
      console.log(
        `${
          actionType === 'checkIn' ? 'Check-in' : 'Check-out'
        } from anywhere is allowed.`,
      );
      return true;
    }

    if (
      !employeeDetails.branch ||
      employeeDetails.custom_all_location_attendance
    ) {
      console.log(
        'Branch is null or all branches attendance is enabled, allowed to check in/out from any branch location.',
      );
      const isWithinAnyBranchRadius = branchLocations.some(branch => {
        const distanceToBranch = getDistanceFromLatLonInKm(
          location.latitude,
          location.longitude,
          branch.custom_latitude,
          branch.custom_longitude,
        );
        return distanceToBranch <= 0.05;
      });
      console.log(`Within any branch radius: ${isWithinAnyBranchRadius}`);
      return isWithinAnyBranchRadius;
    }

    const branchLocation = branchLocations.find(
      loc => loc.branch === employeeDetails.branch,
    );
    if (!branchLocation) {
      console.log('No matching branch location found.');
      return false;
    }

    const distanceToBranch = getDistanceFromLatLonInKm(
      location.latitude,
      location.longitude,
      branchLocation.custom_latitude,
      branchLocation.custom_longitude,
    );

    console.log(`Distance to branch: ${distanceToBranch} km`);
    return distanceToBranch <= 0.05;
  };

  const handleCheckIn = async () => {
    console.log('Attempting to check in...');
    if (!canCheckInOrOut('checkIn')) {
      Alert.alert(
        'Check-in Failed',
        'You are not within the allowed location radius.',
      );
      return;
    }
    try {
      const deviceID = employeeDetails.custom_job_location || 'Mobile Device';
      const result = await checkIn(employeeDetails.name, location, deviceID);
      Alert.alert('Check-in Successful', 'Attendance recorded successfully.');
    } catch (error) {
      console.error('Check-in Error:', error.response?.data || error.message);
      Alert.alert(
        'Check-in Failed',
        `Error: ${error.response?.data?.message || error.message}`,
      );
    }
  };

  const handleCheckOut = async () => {
    console.log('Attempting to check out...');
    if (!canCheckInOrOut('checkOut')) {
      Alert.alert(
        'Check-out Failed',
        'You are not within the allowed location radius.',
      );
      return;
    }
    try {
      const deviceID = employeeDetails.custom_job_location || 'Mobile Device';
      const result = await checkOut(employeeDetails.name, location, deviceID);
      Alert.alert('Check-out Successful', 'Attendance recorded successfully.');
    } catch (error) {
      console.error('Check-out Error:', error.response?.data || error.message);
      Alert.alert(
        'Check-out Failed',
        `Error: ${error.response?.data?.message || error.message}`,
      );
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
        {/* <View style={styles.locationInfo}>
          <Text style={styles.locationText}>Current Latitude: {location?.latitude}</Text>
          <Text style={styles.locationText}>Current Longitude: {location?.longitude}</Text>
        </View> */}
        <TouchableOpacity
          style={[
            styles.button,
            !canCheckInOrOut('checkIn') && styles.disabledButton,
          ]}
          onPress={handleCheckIn}
          disabled={!canCheckInOrOut('checkIn')}>
          <Text style={styles.buttonText}>Check In</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.button,
            !canCheckInOrOut('checkOut') && styles.disabledButton,
          ]}
          onPress={handleCheckOut}
          disabled={!canCheckInOrOut('checkOut')}>
          <Text style={styles.buttonText}>Check Out</Text>
        </TouchableOpacity>
      </ScrollView>
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
    backgroundColor: '#A9A9A9',
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
