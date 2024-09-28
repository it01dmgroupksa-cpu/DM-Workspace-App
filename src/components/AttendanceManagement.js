import React, { useContext, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { RNCamera } from 'react-native-camera';
import Geolocation from '@react-native-community/geolocation';
import NetInfo from '@react-native-community/netinfo';
import {
  checkIn,
  checkOut,
  getBranchLocations,
  uploadImageToImgur,
  hasCheckedInToday,
  hasCheckedOutToday,
} from '../../api';
import { EmployeeContext } from '../context/EmployeeContext';
import { useNavigation } from '@react-navigation/native';
import { LogInIcon, LogOutIcon, LocationIcon, WifiIcon, CalendarIcon, ClockIcon } from './icons';
import moment from 'moment';

const AttendanceManagement = () => {
  const { employeeDetails } = useContext(EmployeeContext);
  const [location, setLocation] = useState(null);
  const [branchLocations, setBranchLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [networkStatus, setNetworkStatus] = useState(null);
  const [distanceToOffice, setDistanceToOffice] = useState(null);
  const [canCheckIn, setCanCheckIn] = useState(false);
  const [canCheckOut, setCanCheckOut] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [currentDateTime, setCurrentDateTime] = useState(moment());
  const navigation = useNavigation();
  const cameraRef = useRef(null);

  useEffect(() => {
    const setupComponent = async () => {
      await fetchBranchLocations();
      getLocation();
      checkNetworkStatus();
    };

    const dateTimeInterval = setInterval(() => {
      setCurrentDateTime(moment());
    }, 60000);

    setupComponent();
    const locationInterval = setInterval(getLocation, 5000);
    const networkInterval = setInterval(checkNetworkStatus, 10000);

    return () => {
      clearInterval(locationInterval);
      clearInterval(networkInterval);
      clearInterval(dateTimeInterval);
    };
  }, []);

  useEffect(() => {
    if (location && branchLocations.length > 0) {
      updateAttendanceStatus();
    }
  }, [location, branchLocations]);

  const fetchBranchLocations = async () => {
    try {
      const locations = await getBranchLocations();
      setBranchLocations(locations);
    } catch (error) {
      console.error('Failed to fetch branch locations:', error);
      setStatusMessage('Unable to fetch office locations. Please try again later.');
    }
  };

  const getLocation = () => {
    Geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position.coords;
        setLocation({ latitude, longitude });
      },
      error => {
        console.error(error);
        setStatusMessage('Unable to detect your location. Please check your GPS settings.');
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 },
    );
  };

  const checkNetworkStatus = () => {
    NetInfo.fetch().then(state => {
      setNetworkStatus(state);
      if (!state.isConnected) {
        setStatusMessage('No internet connection. Please check your network settings.');
      }
    });
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

  const updateAttendanceStatus = async () => {
    if (!location || branchLocations.length === 0) return;

    let nearestBranchDistance = Infinity;
    let nearestBranch = null;

    branchLocations.forEach(branch => {
      const distance = getDistanceFromLatLonInKm(
        location.latitude,
        location.longitude,
        branch.custom_latitude,
        branch.custom_longitude
      );
      if (distance < nearestBranchDistance) {
        nearestBranchDistance = distance;
        nearestBranch = branch;
      }
    });

    setDistanceToOffice(nearestBranchDistance);

    const canCheckInStatus = await canCheckInOrOut('checkIn');
    const canCheckOutStatus = await canCheckInOrOut('checkOut');

    setCanCheckIn(canCheckInStatus);
    setCanCheckOut(canCheckOutStatus);

    if (!canCheckInStatus && !canCheckOutStatus) {
      setStatusMessage(`You are ${nearestBranchDistance.toFixed(2)} km away from the nearest office. Please move closer to check in/out.`);
    } else {
      setStatusMessage('');
    }

    setIsLoading(false);
  };

  const canCheckInOrOut = async (actionType) => {
    if (!location || !networkStatus?.isConnected) return false;

    const outsideCheck =
      actionType === 'checkIn'
        ? employeeDetails.custom_outside_check_in
        : employeeDetails.custom_outside_check_out;

    if (outsideCheck) return true;

    if (
      !employeeDetails.branch ||
      employeeDetails.custom_all_location_attendance
    ) {
      return branchLocations.some((branch) => {
        const distanceToBranch = getDistanceFromLatLonInKm(
          location.latitude,
          location.longitude,
          branch.custom_latitude,
          branch.custom_longitude,
        );
        return distanceToBranch <= 0.05;
      });
    }

    const branchLocation = branchLocations.find(
      (loc) => loc.branch === employeeDetails.branch,
    );
    if (!branchLocation) return false;

    const distanceToBranch = getDistanceFromLatLonInKm(
      location.latitude,
      location.longitude,
      branchLocation.custom_latitude,
      branchLocation.custom_longitude,
    );

    return distanceToBranch <= 0.05;
  };

  const captureImage = async () => {
    if (cameraRef.current && employeeDetails.custom_capture_selfie) {
      const options = { quality: 0.5, base64: true };
      const data = await cameraRef.current.takePictureAsync(options);
      return data;
    }
    return null;
  };

  const handleCheckIn = async () => {
    if (!canCheckIn) {
      Alert.alert('Check-in Not Allowed', statusMessage);
      return;
    }

    try {
      setIsLoading(true);
      const hasCheckedIn = await hasCheckedInToday(employeeDetails.name);

      if (hasCheckedIn) {
        Alert.alert('Already Checked In', 'You have already checked in today.');
        return;
      }

      const deviceID = employeeDetails.custom_job_location || 'Mobile Device';
      const currentTime = moment().format('YYYY-MM-DD_HH-mm-ss');
      const fileName = `${employeeDetails.name}_CheckIn_${currentTime}_${deviceID}.jpg`;

      let imageLink = null;
      if (employeeDetails.custom_capture_selfie) {
        const imageData = await captureImage();
        if (imageData) {
          imageLink = await uploadImageToImgur(imageData.base64, fileName);
        }
      }

      await checkIn(employeeDetails.name, location, deviceID, imageLink);
      Alert.alert('Check-in Successful', 'Attendance recorded successfully.');
    } catch (error) {
      console.error('Check-in Error:', error.response?.data || error.message);
      Alert.alert('Check-in Failed', `Error: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!canCheckOut) {
      Alert.alert('Check-out Not Allowed', statusMessage);
      return;
    }

    try {
      setIsLoading(true);
      const hasCheckedOut = await hasCheckedOutToday(employeeDetails.name);

      if (hasCheckedOut) {
        Alert.alert('Already Checked Out', 'You have already checked out today.');
        return;
      }

      const deviceID = employeeDetails.custom_job_location || 'Mobile Device';
      const currentTime = moment().format('YYYY-MM-DD_HH-mm-ss');
      const fileName = `${employeeDetails.name}_CheckOut_${currentTime}_${deviceID}.jpg`;

      let imageLink = null;
      if (employeeDetails.custom_capture_selfie) {
        const imageData = await captureImage();
        if (imageData) {
          imageLink = await uploadImageToImgur(imageData.base64, fileName);
        }
      }

      await checkOut(employeeDetails.name, location, deviceID, imageLink);
      Alert.alert('Check-out Successful', 'Attendance recorded successfully.');
    } catch (error) {
      console.error('Check-out Error:', error.response?.data || error.message);
      Alert.alert('Check-out Failed', `Error: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!employeeDetails || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#153156" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <Text style={styles.title}>Attendance Management</Text>
        <View style={styles.cameraContainer}>
          {employeeDetails.custom_capture_selfie ? (
            <RNCamera
              ref={cameraRef}
              style={styles.camera}
              type={RNCamera.Constants.Type.front}
              captureAudio={false}
            />
          ) : (
            <View style={styles.disabledCamera} />
          )}
          <View style={styles.overlay}>
            <View style={styles.outerCircle}>
              <View style={styles.innerCircle} />
            </View>
          </View>
        </View>
        <View style={styles.infoContainer}>
          <Text style={styles.welcomeTexthead}>Welcome, </Text>
          <Text style={styles.welcomeText}>{employeeDetails.name}</Text>
          <View style={styles.dateTimeContainer}>
            <View style={styles.dateTimeRow}>
              <CalendarIcon width={20} height={20} color="#153156" style={styles.dateTimeIcon} />
              <Text style={styles.dateTimeText}>
                {currentDateTime.format('dddd, MMMM D, YYYY')}
              </Text>
            </View>
            <View style={styles.dateTimeRow}>
              <ClockIcon width={20} height={20} color="#153156" style={styles.dateTimeIcon} />
              <Text style={styles.dateTimeText}>
                {currentDateTime.format('h:mm A')}
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.button, !canCheckIn && styles.disabledButton]}
          onPress={handleCheckIn}
          disabled={!canCheckIn}
        >
          <LogInIcon width={24} height={24} color="#fff" style={styles.buttonIcon} />
          <Text style={styles.buttonText}>Check In</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, !canCheckOut && styles.disabledButton]}
          onPress={handleCheckOut}
          disabled={!canCheckOut}
        >
          <LogOutIcon width={24} height={24} color="#fff" style={styles.buttonIcon} />
          <Text style={styles.buttonText}>Check Out</Text>
        </TouchableOpacity>
        
        <View style={styles.statusSection}>
          <View style={styles.statusCard}>
            <LocationIcon width={24} height={24} color="#153156" style={styles.statusIcon} />
            <View>
              <Text style={styles.statusLabel}>Location Status</Text>
              <Text style={styles.statusText}>
                {distanceToOffice
                  ? `${distanceToOffice.toFixed(2)} km from office`
                  : 'Detecting location...'}
              </Text>
            </View>
          </View>
          <View style={styles.statusCard}>
            <WifiIcon width={24} height={24} color="#153156" style={styles.statusIcon} />
            <View>
              <Text style={styles.statusLabel}>Network Status</Text>
              <Text style={styles.statusText}>
                {networkStatus?.isConnected ? 'Connected' : 'No internet connection'}
              </Text>
            </View>
          </View>
        </View>
        
        {statusMessage ? (
          <View style={styles.messageCard}>
            <Text style={styles.messageText}>{statusMessage}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#153156',
    marginBottom: 30,
    textAlign: 'center',
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
    elevation: 5,
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  disabledCamera: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E0E0E0',
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
    backgroundColor: 'rgba(21, 49, 86, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'transparent',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  infoContainer: {
    width: '100%',
    alignItems: 'flex-start',
    marginTop: 35,
    marginBottom: 25,
  },
  welcomeTexthead: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#153156',
    marginBottom: 10,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#153156',
    marginBottom: 20,
  },
  dateTimeContainer: {
    backgroundColor: '#E6EAF0',
    borderRadius: 10,
    padding: 15,
    width: '100%',
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  dateTimeIcon: {
    marginRight: 10,
  },
  dateTimeText: {
    fontSize: 16,
    color: '#153156',
    fontWeight: '500',
  },
  button: {
    flexDirection: 'row',
    backgroundColor: '#153156',
    paddingVertical: 15,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    elevation: 3,
  },
  disabledButton: {
    backgroundColor: '#A9A9A9',
  },
  buttonIcon: {
    position: 'absolute',
    left: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusSection: {
    width: '100%',
    marginTop: 30,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    elevation: 2,
  },
  statusIcon: {
    marginRight: 15,
  },
  statusLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 5,
  },
  statusText: {
    fontSize: 16,
    color: '#153156',
    fontWeight: 'bold',
  },
  messageCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 15,
    marginTop: 15,
    width: '100%',
  },
  messageText: {
    fontSize: 16,
    color: '#92400E',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
  },
  loadingText: {
    fontSize: 18,
    color: '#153156',
    marginTop: 10,
  },
});

export default AttendanceManagement;