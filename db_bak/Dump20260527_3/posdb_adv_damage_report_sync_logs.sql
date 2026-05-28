CREATE DATABASE  IF NOT EXISTS `posdb_adv` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci */;
USE `posdb_adv`;
-- MySQL dump 10.13  Distrib 8.0.34, for Win64 (x86_64)
--
-- Host: localhost    Database: posdb_adv
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
-- Table structure for table `damage_report_sync_logs`
--

DROP TABLE IF EXISTS `damage_report_sync_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `damage_report_sync_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `damage_report_id` int(11) NOT NULL,
  `report_number` varchar(30) NOT NULL,
  `sync_batch_id` varchar(64) NOT NULL,
  `synced_by_user_id` varchar(45) DEFAULT NULL,
  `synced_by_username` varchar(255) DEFAULT NULL,
  `synced_at` datetime NOT NULL DEFAULT current_timestamp(),
  `status` varchar(20) NOT NULL,
  `error_summary` text DEFAULT NULL,
  `warnings_json` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_damage_sync_logs_report` (`damage_report_id`),
  KEY `idx_damage_sync_logs_batch` (`sync_batch_id`),
  KEY `idx_damage_sync_logs_synced_at` (`synced_at`),
  KEY `idx_damage_sync_logs_report_number` (`report_number`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `damage_report_sync_logs`
--

LOCK TABLES `damage_report_sync_logs` WRITE;
/*!40000 ALTER TABLE `damage_report_sync_logs` DISABLE KEYS */;
INSERT INTO `damage_report_sync_logs` VALUES (1,1,'DR-2026-001','b804a242-358b-4bfa-bd5b-e6b16d551884','1','admin','2026-05-24 18:24:58','success',NULL,NULL);
/*!40000 ALTER TABLE `damage_report_sync_logs` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-27 21:09:36
