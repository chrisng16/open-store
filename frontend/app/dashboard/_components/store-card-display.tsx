"use client"
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Store, useStoresQuery } from '@/queries/stores'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export default function StoreCardDisplay() {
    const { data, isLoading } = useStoresQuery()

    if (isLoading) {
        return (<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <StoreCardSkeleton key={i} />)}
        </div>)
    }
    return (
        data && data.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {data.map((store) => <StoreCard key={store.id} {...store} />)}
            </div>
        ) : (
            <div className="flex h-full flex-col items-center justify-center text-center gap-4 py-8">
                <Plus className="h-12 w-12 text-muted-foreground" />
                <h3 className="text-lg font-semibold">No stores yet</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                    Create a store to start selling products, manage inventory, and
                    accept orders — it only takes a minute.
                </p>
                <Link href="/dashboard/store/new" className="mt-2">
                    <Button className="inline-flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Create Store
                    </Button>
                </Link>
            </div>

        ))
}

function StoreCard({ id, name, slug }: Store) {
    return (
        <Link href={`/dashboard/${id}/onboarding`} className="block">
            <Card>
                <CardHeader className='gap-0'>
                    <CardTitle className='font-medium text-lg'>{name}</CardTitle>
                    <p className='text-muted-foreground text-sm'>Slug: {slug}</p>
                </CardHeader>
            </Card>
        </Link>
    )
}

function StoreCardSkeleton() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="w-1/2 h-6 animate-pulse" />
                <Skeleton className="w-1/3 h-4 animate-pulse mt-2" />
            </CardHeader>
        </Card>
    )
}