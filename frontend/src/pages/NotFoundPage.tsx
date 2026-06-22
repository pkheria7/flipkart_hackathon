import { Link } from 'react-router-dom'
import { CommandButton } from '@/components/ui/CommandButton'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageScaffold } from '@/components/ui/PageScaffold'

export function NotFoundPage() {
  return (
    <PageScaffold title="Page Not Found" description="The requested route does not exist.">
      <EmptyState
        title="404 — Route not found"
        description="Return to the command center or mission brief."
        action={
          <div className="flex gap-2">
            <Link to="/">
              <CommandButton variant="primary">Mission Brief</CommandButton>
            </Link>
            <Link to="/command">
              <CommandButton variant="cyan">Command Center</CommandButton>
            </Link>
          </div>
        }
      />
    </PageScaffold>
  )
}
