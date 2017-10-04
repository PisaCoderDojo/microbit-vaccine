#!/usr/bin/python3

import serial

if __name__ == "__main__":
	ser = serial.Serial ('/dev/ttyACM0', 115200, timeout=2)
	
	while True:
		data = ser.readline().strip().decode("utf-8")
		if not data == "":
			print (data)
