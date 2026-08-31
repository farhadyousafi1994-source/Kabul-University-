<?php

namespace Database\Seeders;

use App\Domains\System\Services\SettingsService;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(RolesAndPermissionsSeeder::class);
        $this->call(OrganizationSeeder::class);
        $this->call(CatalogSeeder::class);
        $this->call(DemoUserSeeder::class);
        SettingsService::seedDefaults();
    }
}

/**
 * Organization tree: campuses → faculties → departments / buildings → floors → rooms.
 */
class OrganizationSeeder extends Seeder
{
    public function run(): void
    {
        $campus = \App\Domains\Organization\Models\Campus::firstOrCreate(
            ['code' => 'CAMP-MAIN'],
            ['name' => 'Kabul University Main Campus', 'address' => 'Jamal Mena, District 3, Kabul, Afghanistan'],
        );

        $faculties = [
            ['FAC-CS', 'Faculty of Computer Science'],
            ['FAC-ENG', 'Faculty of Engineering'],
            ['FAC-ECO', 'Faculty of Economics'],
            ['FAC-MED', 'Faculty of Medicine'],
            ['FAC-LAW', 'Faculty of Law and Political Science'],
            ['FAC-EDU', 'Faculty of Education'],
        ];

        $facultyModels = [];
        foreach ($faculties as [$code, $name]) {
            $facultyModels[$code] = \App\Domains\Organization\Models\Faculty::firstOrCreate(
                ['code' => $code],
                ['campus_id' => $campus->id, 'name' => $name],
            );
        }

        $departments = [
            ['FAC-CS', 'DEPT-CS-SW', 'Software Engineering Department'],
            ['FAC-CS', 'DEPT-CS-IS', 'Information Systems Department'],
            ['FAC-ENG', 'DEPT-ENG-CIV', 'Civil Engineering Department'],
            ['FAC-ENG', 'DEPT-ENG-ELEC', 'Electrical Engineering Department'],
            ['FAC-ECO', 'DEPT-ECO-ACC', 'Accounting Department'],
            ['FAC-MED', 'DEPT-MED-BAS', 'Basic Sciences Department'],
        ];

        foreach ($departments as [$faculty, $code, $name]) {
            \App\Domains\Organization\Models\Department::firstOrCreate(
                ['code' => $code],
                ['faculty_id' => $facultyModels[$faculty]->id, 'name' => $name],
            );
        }

        $buildings = [
            ['BLD-CS', 'Computer Science Building'],
            ['BLD-ENG', 'Engineering Block'],
            ['BLD-LIB', 'Central Library'],
            ['BLD-SCI', 'Science Laboratories'],
        ];

        $buildingModels = [];
        foreach ($buildings as [$code, $name]) {
            $buildingModels[$code] = \App\Domains\Organization\Models\Building::firstOrCreate(
                ['code' => $code],
                ['campus_id' => $campus->id, 'name' => $name],
            );
        }

        $rooms = [
            ['BLD-CS', 1, 'R-CS-101', 'Computer Lab 1', 'laboratory'],
            ['BLD-CS', 1, 'R-CS-102', 'IT Support Office', 'office'],
            ['BLD-CS', 2, 'R-CS-201', 'Networking Lab', 'laboratory'],
            ['BLD-CS', 3, 'R-CS-301', 'Dean Office', 'office'],
            ['BLD-LIB', 1, 'R-LIB-101', 'Reading Hall', 'library'],
            ['BLD-LIB', 2, 'R-LIB-201', 'Digital Library', 'library'],
            ['BLD-SCI', 1, 'R-SCI-101', 'Chemistry Lab', 'laboratory'],
            ['BLD-SCI', 3, 'R-SCI-301', 'Science Store', 'warehouse'],
        ];

        foreach ($rooms as [$building, $level, $code, $name, $type]) {
            $floor = \App\Domains\Organization\Models\Floor::firstOrCreate(
                ['code' => $building.'-F'.$level],
                ['building_id' => $buildingModels[$building]->id, 'name' => 'Floor '.$level, 'level' => $level],
            );

            \App\Domains\Organization\Models\Room::firstOrCreate(
                ['code' => $code],
                ['floor_id' => $floor->id, 'name' => $name, 'room_type' => $type],
            );
        }
    }
}

/**
 * Asset categories, subcategories, suppliers.
 */
class CatalogSeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['CAT-IT', 'IT Equipment', [
                ['SUB-IT-COMP', 'Computers'],
                ['SUB-IT-PRINT', 'Printers & Peripherals'],
            ]],
            ['CAT-FUR', 'Furniture', [
                ['SUB-FUR-DESK', 'Desks & Chairs'],
                ['SUB-FUR-STOR', 'Storage & Shelving'],
            ]],
            ['CAT-LAB', 'Laboratory Equipment', [
                ['SUB-LAB-CHEM', 'Chemistry Equipment'],
                ['SUB-LAB-PHYS', 'Physics Equipment'],
                ['SUB-LAB-BIO', 'Biology Equipment'],
            ]],
            ['CAT-OFF', 'Office Equipment', [
                ['SUB-OFF-PROJ', 'Projectors'],
                ['SUB-OFF-COPY', 'Photocopiers'],
            ]],
            ['CAT-VEH', 'Vehicles', [
                ['SUB-VEH-CAR', 'Cars'],
                ['SUB-VEH-MOTO', 'Motorcycles'],
            ]],
            ['CAT-NET', 'Networking Equipment', [
                ['SUB-NET-SW', 'Switches & Routers'],
                ['SUB-NET-CAB', 'Cabling & Accessories'],
            ]],
        ];

        foreach ($categories as [$code, $name, $subs]) {
            $category = \App\Domains\Asset\Models\AssetCategory::firstOrCreate(['code' => $code], ['name' => $name]);

            foreach ($subs as [$subCode, $subName]) {
                \App\Domains\Asset\Models\AssetSubcategory::firstOrCreate(
                    ['code' => $subCode],
                    ['category_id' => $category->id, 'name' => $subName],
                );
            }
        }

        $suppliers = [
            ['SUP-001', 'Kabul Tech Solutions', '+93 700 111 001', 'sales@kabulttech.af'],
            ['SUP-002', 'Alokozay Trading Co.', '+93 700 111 002', 'info@alokozay.af'],
            ['SUP-003', 'Darul Aman Scientific Supplies', '+93 700 111 003', 'orders@dassci.af'],
            ['SUP-004', 'Afghan Motors Ltd.', '+93 700 111 004', 'sales@afghanmotors.af'],
            ['SUP-005', 'Network Pro Afghanistan', '+93 700 111 005', 'hello@networkpro.af'],
        ];

        foreach ($suppliers as [$code, $name, $phone, $email]) {
            \App\Domains\Procurement\Models\Supplier::firstOrCreate(['code' => $code], [
                'name' => $name, 'phone' => $phone, 'email' => $email,
            ]);
        }

        \App\Domains\Financial\Models\DepreciationMethod::firstOrCreate(
            ['code' => 'SL'],
            ['name' => 'Straight Line', 'formula' => '(Purchase Price - Salvage Value) / Useful Life'],
        );
    }
}

/**
 * Demo users for every role (password: "password").
 */
class DemoUserSeeder extends Seeder
{
    public function run(): void
    {
        $users = [
            ['Abdul Rahman Ahmadzai', 'superadmin', 'superadmin@ku.edu.af', 'Super Admin'],
            ['Maryam Nazari', 'administrator', 'admin@ku.edu.af', 'University Administrator'],
            ['Hassan Karimi', 'assetmanager', 'assets@ku.edu.af', 'Asset Manager'],
            ['Sara Rahimi', 'facultymanager', 'faculty.cs@ku.edu.af', 'Faculty Manager'],
            ['Omid Stanikzai', 'deptmanager', 'dept@ku.edu.af', 'Department Manager'],
            ['Nadia Wahidi', 'warehousemanager', 'warehouse@ku.edu.af', 'Warehouse Manager'],
            ['Farid Ahmadi', 'technician', 'tech@ku.edu.af', 'Maintenance Technician'],
            ['Zarghona Habibi', 'auditor', 'audit@ku.edu.af', 'Auditor'],
            ['Ahmad Farid', 'employee', 'employee@ku.edu.af', 'Employee'],
        ];

        foreach ($users as [$name, $username, $email, $role]) {
            $user = User::firstOrCreate(
                ['username' => $username],
                [
                    'name' => $name,
                    'email' => $email,
                    'password' => 'password',
                    'status' => User::STATUS_ACTIVE,
                ],
            );

            if (! $user->hasRole($role)) {
                $user->assignRole($role);
            }
        }
    }
}
