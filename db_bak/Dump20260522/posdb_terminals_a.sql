CREATE DATABASE  IF NOT EXISTS `posdb` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci */;
USE `posdb`;
-- MySQL dump 10.13  Distrib 8.0.34, for Win64 (x86_64)
--
-- Host: localhost    Database: posdb
-- ------------------------------------------------------
-- Server version	5.5.5-10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `terminals_a`
--

DROP TABLE IF EXISTS `terminals_a`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `terminals_a` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `machine_name` varchar(100) DEFAULT NULL COMMENT 'Friendly name (e.g., “POS Terminal 1”)',
  `serial_number` varchar(100) DEFAULT NULL COMMENT 'Machine’s hardware serial number',
  `min_number` varchar(100) DEFAULT NULL COMMENT 'MIN (Machine Identification Number) assigned by BIR',
  `ptu_number` varchar(100) DEFAULT NULL COMMENT 'Permit to Use number from BIR',
  `or_start` int(11) DEFAULT NULL COMMENT 'OR range start',
  `or_end` int(11) DEFAULT NULL COMMENT 'OR range end',
  `current_or` int(11) DEFAULT 1,
  `valid_start` date DEFAULT NULL,
  `valid_end` date DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp() COMMENT 'When it was registered in the system',
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_active` tinyint(1) DEFAULT 1 COMMENT '1 = active, 0 = inactive',
  PRIMARY KEY (`ID`),
  UNIQUE KEY `unique_machine_name` (`machine_name`),
  UNIQUE KEY `unique_serial_number` (`serial_number`),
  UNIQUE KEY `unique_min_number` (`min_number`),
  UNIQUE KEY `unique_ptu_number` (`ptu_number`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `terminals_a`
--

LOCK TABLES `terminals_a` WRITE;
/*!40000 ALTER TABLE `terminals_a` DISABLE KEYS */;
INSERT INTO `terminals_a` VALUES (3,'POS-0001','SN-1029291','MIN-100201','PTU-593939',1,5000,49,'2025-07-01','2030-07-01','2025-07-18 13:25:34','2026-03-29 13:27:07',1);
/*!40000 ALTER TABLE `terminals_a` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-22 16:37:20
