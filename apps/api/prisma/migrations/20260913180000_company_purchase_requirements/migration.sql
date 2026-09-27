ALTER TABLE `User`
  ADD COLUMN `stateRegistrationExempt` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `companyRegistrationStatus` VARCHAR(40) NULL,
  ADD COLUMN `legalRepresentativeName` VARCHAR(191) NULL,
  ADD COLUMN `legalRepresentativeCpf` VARCHAR(11) NULL,
  ADD COLUMN `legalRepresentativeDocument` VARCHAR(30) NULL,
  ADD COLUMN `legalRepresentativeRole` VARCHAR(60) NULL,
  ADD COLUMN `representationBasis` VARCHAR(30) NULL,
  ADD COLUMN `representationDocumentChecked` BOOLEAN NOT NULL DEFAULT false;
