#!/usr/bin/python3

import serial

if __name__ == "__main__":
	ser = serial.Serial ('/dev/ttyACM0', 115200, timeout=2)
	
	while True:
		data_raw = ser.readline().strip()
		if not data_raw == b"":
			print (data_raw)
