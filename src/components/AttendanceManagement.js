import React, {
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Modal,
  ActivityIndicator,
  Image,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import {RNCamera} from 'react-native-camera';
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
import {EmployeeContext} from '../context/EmployeeContext';
import {useNavigation} from '@react-navigation/native';
import {
  LogInIcon,
  LogOutIcon,
  LocationIcon,
  WifiIcon,
  CalendarIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
} from './icons';
import moment from 'moment';
import { CommonActions } from '@react-navigation/native';

const AttendanceManagement = () => {
  const {employeeDetails, setEmployeeDetails} = useContext(EmployeeContext);
  const [location, setLocation] = useState(null);
  const [branchLocations, setBranchLocations] = useState([]);
  const [networkStatus, setNetworkStatus] = useState(null);
  const [distanceToOffice, setDistanceToOffice] = useState(null);
  const [currentDateTime, setCurrentDateTime] = useState(moment());
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [attendanceType, setAttendanceType] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isStatusSuccess, setIsStatusSuccess] = useState(false);
  const [locationDetectionAttempts, setLocationDetectionAttempts] = useState(0);
  const [isDetectingLocation, setIsDetectingLocation] = useState(true);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);
  const [isBranchLocationsReady, setIsBranchLocationsReady] = useState(false);
  const [locationStatus, setLocationStatus] = useState('detecting');
  const [isLogoutModalVisible, setIsLogoutModalVisible] = useState(false);
  const locationUpdateTimeRef = useRef(null);
  const cameraRef = useRef(null);
  const navigation = useNavigation();
  const [locationError, setLocationError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRY_ATTEMPTS = 3;

  useEffect(() => {
    requestLocationPermission();
    fetchBranchLocations();
    checkNetworkStatus();

    const dateTimeInterval = setInterval(() => {
      setCurrentDateTime(moment());
    }, 60000);

    return () => {
      clearInterval(dateTimeInterval);
    };
  }, []);

  useEffect(() => {
    const initializeComponent = async () => {
      await fetchBranchLocations();
      await requestLocationPermission();
    };

    initializeComponent();
  }, []);

  useEffect(() => {
    if (isDetectingLocation && branchLocations.length > 0) {
      const locationInterval = setInterval(getLocation, 10000);
      return () => clearInterval(locationInterval);
    }
  }, [isDetectingLocation, branchLocations, getLocation]);

  useEffect(() => {
    if (!employeeDetails) {
      navigation.navigate('Login');
    }
  }, [employeeDetails, navigation]);
  

  const handleLogout = () => {
    setEmployeeDetails(null); // Clear employee details from context
  };

  const showLogoutModal = () => {
    setIsLogoutModalVisible(true);
  };

  const hideLogoutModal = () => {
    setIsLogoutModalVisible(false);
  };

  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          console.log('Location permission denied');
          setStatusMessage(
            'Location permission denied. Please enable location services to use this feature.',
          );
          setIsStatusSuccess(false);
          setShowStatusModal(true);
          setIsDetectingLocation(false);
        } else {
          getLocation();
        }
      } catch (err) {
        console.warn(err);
        setIsDetectingLocation(false);
      }
    } else {
      getLocation();
    }
  };

  const fetchBranchLocations = async () => {
    try {
      const locations = await getBranchLocations();
      console.log('Fetched branch locations:', locations);
      setBranchLocations(locations);
      setIsBranchLocationsReady(true);
      console.log('Branch locations are ready');
    } catch (error) {
      console.error('Failed to fetch branch locations:', error);
      setStatusMessage(
        'Failed to fetch office locations. Please try again later.',
      );
      setIsStatusSuccess(false);
      setShowStatusModal(true);
    }
  };

  const checkNetworkStatus = () => {
    NetInfo.fetch().then(state => {
      setNetworkStatus(state);
    });
  };

  const getLocation = useCallback(() => {
    console.log('Getting location...');
    setLocationStatus('detecting');
    setLocationError(null);

    if (branchLocations.length === 0) {
      console.log('Waiting for branch locations...');
      return;
    }

    Geolocation.getCurrentPosition(
      position => {
        const latitude = parseFloat(position.coords.latitude);
        const longitude = parseFloat(position.coords.longitude);

        console.log('Location received - Lat:', latitude, 'Long:', longitude);

        if (isNaN(latitude) || isNaN(longitude)) {
          console.error('Invalid coordinates received');
          setLocationStatus('error');
          setLocationError('Invalid coordinates received');
          return;
        }

        setLocation({latitude, longitude});
        setRetryCount(0);
        setLocationDetectionAttempts(0);
        setIsDetectingLocation(false);

        updateDistanceToOffice({latitude, longitude});
      },
      error => {
        console.error('Location error:', error);
        setLocationStatus('error');
        setLocationError(error.message || 'Unknown error occurred');
        setLocationDetectionAttempts(prev => prev + 1);
        
        if (retryCount < MAX_RETRY_ATTEMPTS) {
          setRetryCount(prevCount => prevCount + 1);
          setTimeout(getLocation, 5000); // Retry after 5 seconds
        } else {
          setIsDetectingLocation(false);
          setStatusMessage(
            'Unable to detect your location. Please check your GPS settings and try again.',
          );
          setIsStatusSuccess(false);
          setShowStatusModal(true);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      },
    );
  }, [branchLocations, retryCount, updateDistanceToOffice]);

  useEffect(() => {
    if (isDetectingLocation && branchLocations.length > 0) {
      getLocation();
    }
  }, [isDetectingLocation, branchLocations, getLocation]);

  const handleRetryLocation = () => {
    setRetryCount(0);
    setLocationDetectionAttempts(0);
    setIsDetectingLocation(true);
    getLocation();
  };

  const updateDistanceToOffice = useCallback(
    currentLocation => {
      console.log('Starting distance calculation...');
      console.log('Current location:', currentLocation);
      console.log('Branch locations ready:', isBranchLocationsReady);
      console.log('Number of branch locations:', branchLocations.length);

      if (!isBranchLocationsReady) {
        console.log('Branch locations not ready yet');
        return;
      }

      if (
        !currentLocation ||
        typeof currentLocation.latitude !== 'number' ||
        typeof currentLocation.longitude !== 'number'
      ) {
        console.error('Invalid location object:', currentLocation);
        setLocationStatus('error');
        return;
      }

      setLocationStatus('calculating');

      try {
        let nearestDistance = Infinity;

        branchLocations.forEach((branch, index) => {
          const branchLat = parseFloat(branch.custom_latitude);
          const branchLong = parseFloat(branch.custom_longitude);

          if (isNaN(branchLat) || isNaN(branchLong)) {
            console.error(`Invalid coordinates for branch ${index}:`, branch);
            return;
          }

          const distance = getDistanceFromLatLonInKm(
            currentLocation.latitude,
            currentLocation.longitude,
            branchLat,
            branchLong,
          );

          console.log(`Distance to ${branch.branch_location}: ${distance} km`);

          if (distance < nearestDistance) {
            nearestDistance = distance;
          }
        });

        if (nearestDistance === Infinity) {
          console.error('No valid distances calculated');
          setLocationStatus('error');
          return;
        }

        console.log('Final nearest distance:', nearestDistance);
        setDistanceToOffice(nearestDistance);
        setLocationStatus('ready');
      } catch (error) {
        console.error('Error during distance calculation:', error);
        setLocationStatus('error');
      }
    },
    [branchLocations, isBranchLocationsReady],
  );

  const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) *
        Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const deg2rad = deg => {
    return deg * (Math.PI / 180);
  };

  const canCheckInOrOut = actionType => {
    if (!location) {
      return false;
    }

    const outsideCheck =
      actionType === 'checkIn'
        ? employeeDetails?.custom_outside_check_in
        : employeeDetails?.custom_outside_check_out;

    if (outsideCheck) {
      return true;
    }

    if (employeeDetails?.custom_all_location_attendance) {
      return branchLocations.some(branch => {
        const distanceToBranch = getDistanceFromLatLonInKm(
          location.latitude,
          location.longitude,
          parseFloat(branch.custom_latitude),
          parseFloat(branch.custom_longitude),
        );
        return distanceToBranch <= 0.05;
      });
    }

    const assignedBranch = branchLocations.find(
      branch => branch.branch_location === employeeDetails?.custom_job_location,
    );

    if (!assignedBranch) {
      console.error('Assigned branch not found');
      return false;
    }

    const distanceToAssignedBranch = getDistanceFromLatLonInKm(
      location.latitude,
      location.longitude,
      parseFloat(assignedBranch.custom_latitude),
      parseFloat(assignedBranch.custom_longitude),
    );

    return distanceToAssignedBranch <= 0.05;
  };

  const handleConfirmAttendance = async () => {
    setIsSubmitting(true);
    setShowConfirmModal(false);
    try {
      const deviceID = employeeDetails?.custom_job_location || 'Mobile Device';
      let imageLink = null;

      if (capturedImage) {
        imageLink = await uploadImageToImgur(
          capturedImage.base64,
          capturedImage.fileName,
        );
      }

      if (attendanceType === 'checkIn') {
        await checkIn(employeeDetails?.name, location, deviceID, imageLink);
      } else {
        await checkOut(employeeDetails?.name, location, deviceID, imageLink);
      }

      setCapturedImage(null);
      setAttendanceType(null);

      setStatusMessage(
        `${
          attendanceType === 'checkIn' ? 'Check-in' : 'Check-out'
        } successful!`,
      );
      setIsStatusSuccess(true);
      setShowStatusModal(true);
    } catch (error) {
      console.error('Attendance Error:', error.response?.data || error.message);
      setStatusMessage(
        `${attendanceType === 'checkIn' ? 'Check-in' : 'Check-out'} failed: ${
          error.response?.data?.message || error.message
        }`,
      );
      setIsStatusSuccess(false);
      setShowStatusModal(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const captureImage = useCallback(async () => {
    if (!cameraRef.current) {
      console.error('Camera reference is not available');
      Alert.alert('Error', 'Camera is not ready yet.');
      return null;
    }
  
    if (cameraRef.current && employeeDetails?.custom_capture_selfie) {
      setIsLoading(true);
      try {
        const options = { quality: 0.5, base64: true };
        const data = await cameraRef.current.takePictureAsync(options);
        return data;
      } finally {
        setIsLoading(false);
      }
    }
    return null;
  }, [employeeDetails?.custom_capture_selfie]);
  

  const handleAttendance = useCallback(
    async type => {
      try {
        const hasChecked =
          type === 'checkIn'
            ? await hasCheckedInToday(employeeDetails?.name)
            : await hasCheckedOutToday(employeeDetails?.name);

        if (hasChecked) {
          setStatusMessage(
            `You have already ${
              type === 'checkIn' ? 'checked in' : 'checked out'
            } today.`,
          );
          setIsStatusSuccess(true);
          setShowStatusModal(true);
          return;
        }

        if (!canCheckInOrOut(type)) {
          if (
            !employeeDetails?.custom_outside_check_in &&
            !employeeDetails?.custom_outside_check_out
          ) {
            if (!employeeDetails?.custom_all_location_attendance) {
              setStatusMessage(
                `You can only ${
                  type === 'checkIn' ? 'check in' : 'check out'
                } at your assigned branch (${
                  employeeDetails?.custom_job_location
                }).`,
              );
            } else {
              const remainingDistance = (distanceToOffice - 0.05).toFixed(2);
              setStatusMessage(
                `You are not within the allowed location radius. Please move closer to the office by approximately ${remainingDistance} km to ${
                  type === 'checkIn' ? 'check in' : 'check out'
                }.`,
              );
            }
          } else {
            setStatusMessage(
              `Unable to ${
                type === 'checkIn' ? 'check in' : 'check out'
              } at this time. Please try again later or contact support if the issue persists.`,
            );
          }
          setIsStatusSuccess(false);
          setShowStatusModal(true);
          return;
        }

        const currentTime = moment().format('YYYY-MM-DD_HH-mm-ss');
        const fileName = `${employeeDetails?.name}_${
          type === 'checkIn' ? 'CheckIn' : 'CheckOut'
        }_${currentTime}.jpg`;

        let imageData = null;
        if (employeeDetails?.custom_capture_selfie) {
          imageData = await captureImage();
          if (imageData) {
            setCapturedImage({
              ...imageData,
              fileName,
            });
          }
        }

        setAttendanceType(type);
        setShowConfirmModal(true);
      } catch (error) {
        console.error(
          'Attendance Error:',
          error.response?.data || error.message,
        );
        setStatusMessage(
          `${type === 'checkIn' ? 'Check-in' : 'Check-out'} failed: ${
            error.response?.data?.message || error.message
          }`,
        );
        setIsStatusSuccess(false);
        setShowStatusModal(true);
      }
    },
    [
      employeeDetails?.name,
      employeeDetails?.custom_capture_selfie,
      employeeDetails?.custom_outside_check_in,
      employeeDetails?.custom_outside_check_out,
      employeeDetails?.custom_all_location_attendance,
      employeeDetails?.custom_job_location,
      captureImage,
      canCheckInOrOut,
      distanceToOffice,
    ],
  );

  const ConfirmationModal = useCallback(
    () => (
      <Modal visible={showConfirmModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Confirm {attendanceType === 'checkIn' ? 'Check-in' : 'Check-out'}
            </Text>
            {capturedImage && (
              <Image
                source={{uri: capturedImage.uri}}
                style={styles.previewImage}
              />
            )}
            <View style={styles.modalDetails}>
              <Text style={styles.modalDetailText}>
                Time: {moment().format('h:mm A')}
              </Text>
              <Text style={styles.modalDetailText}>
                Date: {moment().format('MMMM D, YYYY')}
              </Text>
              {distanceToOffice && (
                <Text style={styles.modalDetailText}>
                  Distance from office: {distanceToOffice.toFixed(2)} km
                </Text>
              )}
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowConfirmModal(false);
                  setCapturedImage(null);
                  setAttendanceType(null);
                }}
                disabled={isSubmitting}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleConfirmAttendance}
                disabled={isSubmitting}>
                <Text style={styles.modalButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    ),
    [
      showConfirmModal,
      attendanceType,
      capturedImage,
      distanceToOffice,
      isSubmitting,
      handleConfirmAttendance,
    ],
  );

  const StatusModal = useCallback(
    () => (
      <Modal visible={showStatusModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {isStatusSuccess ? (
              <CheckCircleIcon width={100} height={100} color="#4CAF50" />
            ) : (
              <XCircleIcon width={100} height={100} color="#F44336" />
            )}
            <Text
              style={[
                styles.modalTitle,
                isStatusSuccess ? styles.successText : styles.errorText,
              ]}>
              {statusMessage}
            </Text>
            <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.confirmButton]}
              onPress={() => setShowStatusModal(false)}>
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    ),
    [showStatusModal, isStatusSuccess, statusMessage],
  );

  const LoadingOverlay = useCallback(
    () => (
      <Modal visible={isLoading || isSubmitting} transparent>
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color="#153156" />
            <Text style={styles.loadingText}>
              {isLoading
                ? 'Taking picture, please wait...'
                : 'Submitting, please wait...'}
            </Text>
          </View>
        </View>
      </Modal>
    ),
    [isLoading, isSubmitting],
  );

  if (!employeeDetails) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading employee details...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {employeeDetails ? (
        <ScrollView contentContainerStyle={styles.contentContainer}>
          <Text style={styles.title}>Attendance Management</Text>
          <View style={styles.cameraContainer}>
            {employeeDetails?.custom_capture_selfie ? (
              <RNCamera
                ref={cameraRef}
                style={styles.camera}
                type={RNCamera.Constants.Type.front}
                captureAudio={false}
                onCameraReady={() => console.log('Camera is ready')}
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
            <Text style={styles.welcomeText}>{employeeDetails?.name}</Text>
            <View style={styles.dateTimeContainer}>
              <View style={styles.dateTimeRow}>
                <CalendarIcon
                  width={20}
                  height={20}
                  color="#153156"
                  style={styles.dateTimeIcon}
                />
                <Text style={styles.dateTimeText}>
                  {currentDateTime.format('dddd, MMMM D, YYYY')}
                </Text>
              </View>
              <View style={styles.dateTimeRow}>
                <ClockIcon
                  width={20}
                  height={20}
                  color="#153156"
                  style={styles.dateTimeIcon}
                />
                <Text style={styles.dateTimeText}>
                  {currentDateTime.format('h:mm A')}
                </Text>
              </View>
            </View>
          </View>
          {locationStatus === 'ready' &&
            distanceToOffice > 0.05 &&
            !employeeDetails?.custom_outside_check_in &&
            !employeeDetails?.custom_outside_check_out && (
              <View style={styles.guidanceContainer}>
                <Text style={styles.guidanceText}>
                  {employeeDetails?.custom_all_location_attendance
                    ? `Move ${(distanceToOffice - 0.05).toFixed(
                        2,
                      )} km closer to check in/out successfully.`
                    : `You can only check in/out at your assigned branch (${employeeDetails?.custom_job_location}).`}
                </Text>
              </View>
            )}
          <TouchableOpacity
            style={[
              styles.button,
              !canCheckInOrOut('checkIn') && styles.disabledButton,
            ]}
            onPress={() => handleAttendance('checkIn')}
            disabled={!canCheckInOrOut('checkIn')}>
            <LogInIcon
              width={24}
              height={24}
              color="#fff"
              style={styles.buttonIcon}
            />
            <Text style={styles.buttonText}>Check In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.button,
              !canCheckInOrOut('checkOut') && styles.disabledButton,
            ]}
            onPress={() => handleAttendance('checkOut')}
            disabled={!canCheckInOrOut('checkOut')}>
            <LogOutIcon
              width={24}
              height={24}
              color="#fff"
              style={styles.buttonIcon}
            />
            <Text style={styles.buttonText}>Check Out</Text>
          </TouchableOpacity>

          <View style={styles.statusSection}>
          <View style={styles.statusCard}>
          <LocationIcon
            width={24}
            height={24}
            color="#153156"
            style={styles.statusIcon}
          />
          <View>
            <Text style={styles.statusLabel}>Location Status</Text>
            <Text
              style={[
                styles.statusText,
                locationStatus === 'error' && styles.errorText,
              ]}>
              {(() => {
                if (branchLocations.length === 0) {
                  return 'Loading office locations...';
                }
                switch (locationStatus) {
                  case 'detecting':
                    return 'Detecting location...';
                  case 'calculating':
                    return 'Calculating distance...';
                  case 'ready':
                    return distanceToOffice !== null
                      ? `${(distanceToOffice - 0.05).toFixed(2)} km from office`
                      : 'Distance calculation complete';
                  case 'error':
                    return locationError || 'Error calculating distance';
                  default:
                    return 'Initializing...';
                }
              })()}
            </Text>
            {locationStatus === 'error' && (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={handleRetryLocation}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
            <View style={styles.statusCard}>
              <WifiIcon
                width={24}
                height={24}
                color="#153156"
                style={styles.statusIcon}
              />
              <View>
                <Text style={styles.statusLabel}>Network Status</Text>
                <Text style={styles.statusText}>
                  {networkStatus?.isConnected
                    ? 'Connected'
                    : 'No internet connection'}
                </Text>
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={showLogoutModal}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>

          {/* Logout Confirmation Modal */}
          <Modal
            visible={isLogoutModalVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={hideLogoutModal}>
            <View style={styles.logoutModalOverlay}>
              <View style={styles.logoutModalContent}>
                <Text style={styles.logoutModalTitle}>Logout</Text>
                <Text style={styles.logoutModalText}>
                  Are you sure you want to logout?
                </Text>
                <View style={styles.logoutModalActions}>
                  <TouchableOpacity
                    style={styles.logoutConfirmButton}
                    onPress={handleLogout}>
                    <Text style={styles.logoutButtonText}>Logout</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.logoutCancelButton}
                    onPress={hideLogoutModal}>
                    <Text style={styles.logoutButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </ScrollView>
      ) : null}
      <ConfirmationModal />
      <StatusModal />
      <LoadingOverlay />
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
  guidanceContainer: {
    backgroundColor: '#FFF3CD',
    borderRadius: 10,
    padding: 15,
    marginVertical: 10,
    width: '100%',
  },
  guidanceText: {
    fontSize: 16,
    color: '#856404',
    textAlign: 'center',
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
  errorText: {
    fontSize: 16,
    color: '#F44336',
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#153156',
    marginBottom: 20,
    textAlign: 'center',
  },
  previewImage: {
    width: 200,
    height: 200,
    borderRadius: 100,
    marginBottom: 20,
  },
  modalDetails: {
    width: '100%',
    marginBottom: 20,
  },
  modalDetailText: {
    fontSize: 16,
    color: '#153156',
    marginBottom: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    marginHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#E0E0E0',
  },
  confirmButton: {
    backgroundColor: '#153156',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  loadingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  loadingContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#153156',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
  },
  successText: {
    color: '#4CAF50',
  },
  logoutButton: {
    backgroundColor: '#D32F2F',
    padding: 15,
    width: '100%',
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  logoutModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  logoutModalContent: {
    backgroundColor: '#FFFFFF',
    padding: 30,
    borderRadius: 10,
    width: '80%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  logoutModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#153156',
    marginBottom: 10,
  },
  logoutModalText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  logoutModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  logoutConfirmButton: {
    backgroundColor: '#D32F2F',
    padding: 10,
    borderRadius: 8,
    width: '45%',
    alignItems: 'center',
  },
  logoutCancelButton: {
    backgroundColor: '#9E9E9E',
    padding: 10,
    borderRadius: 8,
    width: '45%',
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: '#153156',
    padding: 8,
    borderRadius: 5,
    marginTop: 10,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default AttendanceManagement;
