#!/usr/bin/python3

import serial

class Graph:
	
	def __init__ (self):
		self.nodes = []
		self.links = []
		self.autoreload = True

'''

 nodes information:
 
 B	PATIENTZERO
 C	VACCINED
 D	NORMAL
 E	NORMAL
 ...
  
 groups association:
 
 1	patientzero
 2	infected
 3	vaccined
 4	healthy
 
'''

_GROUPS = { "PATIENTZERO": 1,
            "INFECTED": 2,
            "VACCINED": 3,
            "NORMAL": 4 }
            
_OUTPUT_FILENAME = "disease_viz/disease_data.json"

import json

def dump_graph (graph):
	with open (_OUTPUT_FILENAME, "w") as fout:
		json.dump ( g.__dict__, fout )
	
def infect_node ( graph, id ):
	for node in graph.nodes:
		if node["id"] == id:
			node["group"] = _GROUPS ["INFECTED"]

def contains_arc ( graph, source, target ):
	for arc in graph.links:
		if arc["source"] == source and arc["target"] == target:
			return True
	return False

if __name__ == "__main__":
	ser = serial.Serial ('/dev/ttyACM0', 115200, timeout=2)
	
	reading_nodes_information = False
	reading_arcs_information = False
	
	g = Graph ()
	
	while True:
		try:
			data = ser.readline().strip().decode("utf-8")
			if not data == "":
				print (data)
				
				if not data[0] == "#":
					if data == "== restarted ==":
						g = Graph ()
						dump_graph (g)
						reading_nodes_information = False
						reading_arcs_information = False
					elif data == "== nodes information ==":
						reading_nodes_information = True
						reading_arcs_information = False
					elif data == "== arcs information ==":
						dump_graph (g)
						reading_arcs_information = True
						reading_nodes_information = False
					elif data == "== game over ==":
						g.autoreload = False
						dump_graph (g)
						reading_nodes_information = False
						reading_arcs_information = False
					elif reading_nodes_information:
						data_split = data.split()
						id = data_split[0]
						group = _GROUPS[ data_split[1] ]
						g.nodes.append ( {"id": id, "group": group} )
					elif reading_arcs_information:
						data_split = data.split()
						source = data_split[0]
						kind = data_split[1]
						target = data_split[2]
						if kind == "TRIED":
							if not contains_arc (g, source, target):
								g.links.append ( {"source":source, "target":target, "value":1} )
						else:
							infect_node ( g, target )
							g.links.append ( {"source":source, "target":target, "value":20} )
							
						dump_graph (g)
		except Exception as e:
			print ("ERROR")
			print (e)
			print ("data = {}".format(data))
			print ("g = {}".format (g.__dict__))
				
